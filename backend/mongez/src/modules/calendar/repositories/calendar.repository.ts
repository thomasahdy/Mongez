import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { CalendarEventSource, CalendarEventVisibility } from '@prisma/client';

@Injectable()
export class CalendarRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(
    spaceId: string,
    createdById: string,
    dto: CreateEventDto,
    source: CalendarEventSource = CalendarEventSource.MONGEZ,
  ) {
    const { participants, startDate, endDate, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.calendarEvent.create({
        data: {
          ...rest,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          spaceId,
          createdById,
          source,
        },
      });

      if (participants && participants.length > 0) {
        const participantData = await Promise.all(
          participants.map(async (email) => {
            // Check if there is an existing Mongez user with this email
            const matchedUser = await tx.user.findUnique({
              where: { email },
              select: { id: true },
            });

            return {
              eventId: event.id,
              email,
              userId: matchedUser?.id || null,
              status: 'PENDING',
            };
          }),
        );

        await tx.calendarEventParticipant.createMany({
          data: participantData,
        });
      }

      return tx.calendarEvent.findUnique({
        where: { id: event.id },
        include: { participants: true },
      });
    });
  }

  async updateEvent(id: string, spaceId: string, dto: UpdateEventDto) {
    const { participants, startDate, endDate, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      // Tenant isolation: ensure the event belongs to this space before mutating.
      // (update by id alone would let a member of one space edit another space's event.)
      const existing = await tx.calendarEvent.findFirst({
        where: { id, spaceId, isDeleted: false },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('Calendar event not found');
      }

      const updateData: any = { ...rest };
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      await tx.calendarEvent.update({
        where: { id },
        data: updateData,
      });

      if (participants !== undefined) {
        // Clear old participants first
        await tx.calendarEventParticipant.deleteMany({
          where: { eventId: id },
        });

        if (participants.length > 0) {
          const participantData = await Promise.all(
            participants.map(async (email) => {
              const matchedUser = await tx.user.findUnique({
                where: { email },
                select: { id: true },
              });

              return {
                eventId: id,
                email,
                userId: matchedUser?.id || null,
                status: 'PENDING',
              };
            }),
          );

          await tx.calendarEventParticipant.createMany({
            data: participantData,
          });
        }
      }

      return tx.calendarEvent.findUnique({
        where: { id },
        include: { participants: true },
      });
    });
  }

  async findEventById(id: string, spaceId: string) {
    return this.prisma.calendarEvent.findFirst({
      where: { id, spaceId, isDeleted: false },
      include: { participants: true },
    });
  }

  async deleteEvent(id: string, spaceId: string) {
    return this.prisma.calendarEvent.updateMany({
      where: { id, spaceId },
      data: { isDeleted: true },
    });
  }

  async findEventsForSpace(
    spaceId: string,
    startDate: Date,
    endDate: Date,
    filters?: {
      source?: CalendarEventSource;
      sources?: CalendarEventSource[];
      userId?: string;
    },
  ) {
    const whereClause: any = {
      spaceId,
      isDeleted: false,
      startDate: { gte: startDate },
      endDate: { lte: endDate },
    };

    if (filters?.source) {
      whereClause.source = filters.source;
    } else if (filters?.sources && filters.sources.length > 0) {
      whereClause.source = { in: filters.sources };
    }

    if (filters?.userId) {
      // Show events created by the user, OR events where the user is a participant
      whereClause.OR = [
        { createdById: filters.userId },
        {
          participants: {
            some: { userId: filters.userId },
          },
        },
      ];
    }

    return this.prisma.calendarEvent.findMany({
      where: whereClause,
      include: {
        participants: true,
      },
      orderBy: {
        startDate: 'asc',
      },
    });
  }

  // --- Holiday Cache ---
  async getHolidays(country: string, year: number) {
    return this.prisma.holidayCache.findUnique({
      where: {
        country_year: {
          country,
          year,
        },
      },
    });
  }

  // --- Google Sync details ---
  async getGoogleSync(userId: string, spaceId: string) {
    return this.prisma.googleCalendarSync.findUnique({
      where: {
        userId_spaceId_calendarId: {
          userId,
          spaceId,
          calendarId: 'primary',
        },
      },
    });
  }

  async upsertGoogleSync(userId: string, spaceId: string, data: any) {
    return this.prisma.googleCalendarSync.upsert({
      where: {
        userId_spaceId_calendarId: {
          userId,
          spaceId,
          calendarId: 'primary',
        },
      },
      create: {
        userId,
        spaceId,
        calendarId: 'primary',
        ...data,
      },
      update: data,
    });
  }

  async findGoogleSyncByChannel(channelId: string) {
    return this.prisma.googleCalendarSync.findFirst({
      where: { channelId, isActive: true },
    });
  }

  async findExpiringSyncChannels(expiryThreshold: Date) {
    return this.prisma.googleCalendarSync.findMany({
      where: {
        isActive: true,
        channelExpiry: { lte: expiryThreshold },
      },
    });
  }
}
