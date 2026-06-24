import { Injectable } from '@nestjs/common';
import { CalendarRepository } from '../repositories/calendar.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { CalendarEventSource } from '@prisma/client';

@Injectable()
export class CalendarService {
  constructor(
    private readonly repo: CalendarRepository,
    private readonly prisma: PrismaService,
  ) {}

  // --- Gregorian ↔ Hijri Umm al-Qura conversion ---
  gregorianToHijri(date: Date): string {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return '';
    }
    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        calendar: 'islamic-umalqura',
        numberingSystem: 'latn',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find((p) => p.type === 'year')?.value;
      const month = parts.find((p) => p.type === 'month')?.value;
      const day = parts.find((p) => p.type === 'day')?.value;
      return `${year}-${month}-${day}`;
    } catch (error) {
      return '';
    }
  }

  hijriToGregorian(hijriStr: string): Date {
    try {
      const [hYear, hMonth, hDay] = hijriStr.split('-').map(Number);
      if (isNaN(hYear) || isNaN(hMonth) || isNaN(hDay)) {
        return new Date();
      }
      // Estimate Gregorian year: H * 0.97 + 622
      const estGYear = Math.floor(hYear * 0.97 + 622);
      // Start searching around mid-year of the estimated Gregorian year
      const baseDate = new Date(estGYear, 5, 15);

      // Search range of +/- 380 days to find exact alignment
      for (let offset = -380; offset <= 380; offset++) {
        const d = new Date(baseDate.getTime() + offset * 24 * 60 * 60 * 1000);
        const formatted = this.gregorianToHijri(d);
        if (formatted === hijriStr) {
          return d;
        }
      }
      return baseDate; // fallback
    } catch (error) {
      return new Date();
    }
  }

  // --- Event CRUD ---
  async createEvent(spaceId: string, createdById: string, dto: CreateEventDto) {
    const start = new Date(dto.startDate);
    const hijriDate = this.gregorianToHijri(start);
    
    // Inject automatically computed hijriDate
    const createData = {
      ...dto,
      hijriDate,
    };

    return this.repo.createEvent(spaceId, createdById, createData);
  }

  async updateEvent(id: string, spaceId: string, dto: UpdateEventDto) {
    const updateData: any = { ...dto };
    if (dto.startDate) {
      updateData.hijriDate = this.gregorianToHijri(new Date(dto.startDate));
    }
    return this.repo.updateEvent(id, spaceId, updateData);
  }

  async getEventById(id: string, spaceId: string) {
    return this.repo.findEventById(id, spaceId);
  }

  async deleteEvent(id: string, spaceId: string) {
    return this.repo.deleteEvent(id, spaceId);
  }

  // --- Unified Feed ---
  async getUnifiedFeed(
    spaceId: string,
    startDateStr: string,
    endDateStr: string,
    userId?: string,
    filters?: {
      sources?: string[];
      holidayCountry?: string;
    },
  ) {
    // Safely parse dates — fall back to current month window when params are missing or invalid
    const parsedStart = new Date(startDateStr);
    const parsedEnd = new Date(endDateStr);
    const startDate = isNaN(parsedStart.getTime())
      ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : parsedStart;
    const endDate = isNaN(parsedEnd.getTime())
      ? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
      : parsedEnd;

    const sources = filters?.sources || ['MONGEZ', 'GOOGLE', 'HOLIDAY', 'MEETING', 'APPROVAL', 'ESCALATION'];

    const feedPromises: Promise<any[]>[] = [];

    // 1. Saved Database Events (includes custom MONGEZ events, synced GOOGLE events, saved MEETING events, etc.)
    const dbSources = sources.filter((s) => s !== 'HOLIDAY' && s !== 'APPROVAL').map((s) => s as CalendarEventSource);
    if (dbSources.length > 0) {
      feedPromises.push(
        this.repo.findEventsForSpace(spaceId, startDate, endDate, {
          sources: dbSources,
          userId,
        }),
      );
    } else {
      feedPromises.push(Promise.resolve([]));
    }

    // 2. Tasks mapping dynamically (if MONGEZ or general tasks are requested)
    if (sources.includes('MONGEZ')) {
      feedPromises.push(
        this.prisma.task.findMany({
          where: {
            board: {
              department: {
                spaceId,
              },
            },
            isArchived: false,
            deletedAt: null,
            OR: [
              { startDate: { gte: startDate, lte: endDate } },
              { dueDate: { gte: startDate, lte: endDate } },
            ],
          },
          include: {
            assignments: {
              include: {
                user: {
                  select: { id: true, email: true, name: true, avatarUrl: true },
                },
              },
            },
          },
        }).then((tasks) =>
          tasks.map((t) => {
            const eventDate = t.startDate || t.dueDate || new Date();
            const dateStr = this.gregorianToHijri(eventDate);
            return {
              id: `task-${t.id}`,
              spaceId,
              title: t.title,
              description: t.description || '',
              startDate: eventDate,
              endDate: t.dueDate || eventDate,
              allDay: false,
              calendarType: 'GREGORIAN',
              hijriDate: dateStr,
              source: CalendarEventSource.MONGEZ,
              visibility: 'PUBLIC',
              taskId: t.id,
              entityType: 'Task',
              entityId: t.id,
              participants: t.assignments.map((a) => ({
                userId: a.user.id,
                email: a.user.email,
                displayName: a.user.name,
                status: 'ACCEPTED',
              })),
              metadata: {
                status: t.status,
                priority: t.priority,
                identifier: t.identifier,
              },
            };
          }),
        ),
      );
    } else {
      feedPromises.push(Promise.resolve([]));
    }

    // 3. Approvals / Workflows (if APPROVAL or ESCALATION is requested)
    if (sources.includes('APPROVAL') || sources.includes('ESCALATION')) {
      feedPromises.push(
        this.prisma.workflowInstance.findMany({
          where: {
            spaceId,
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          include: {
            definition: true,
            requester: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        }).then((workflows) => {
          const events: any[] = [];
          for (const w of workflows) {
            const contextObj = w.context as any;
            const expiresAtStr = contextObj?._approvalExpiresAt;
            const deadline = expiresAtStr
              ? new Date(expiresAtStr)
              : new Date(w.startedAt.getTime() + 7 * 24 * 3600 * 1000); // 7-day fallback

            const isOverdue = new Date() > deadline;
            const isEscalationRequested = sources.includes('ESCALATION') && (w.status === 'TIMED_OUT' || isOverdue);
            const isApprovalRequested = sources.includes('APPROVAL') && !isEscalationRequested;

            if (isApprovalRequested || isEscalationRequested) {
              events.push({
                id: `workflow-${w.id}`,
                spaceId,
                title: isEscalationRequested ? `🚨 OVERDUE: ${w.definition.name}` : `Approval: ${w.definition.name}`,
                description: `Workflow step requested by ${w.requester.name}. Status: ${w.status}`,
                startDate: deadline,
                endDate: deadline,
                allDay: true,
                calendarType: 'GREGORIAN',
                hijriDate: this.gregorianToHijri(deadline),
                source: isEscalationRequested ? CalendarEventSource.ESCALATION : CalendarEventSource.APPROVAL,
                visibility: 'PUBLIC',
                entityType: 'WorkflowInstance',
                entityId: w.id,
                participants: [
                  {
                    userId: w.requester.id,
                    email: w.requester.email,
                    displayName: w.requester.name,
                    status: 'ACCEPTED',
                  },
                ],
                metadata: {
                  status: w.status,
                  definitionName: w.definition.name,
                  requesterId: w.requesterId,
                },
              });
            }
          }
          return events;
        }),
      );
    } else {
      feedPromises.push(Promise.resolve([]));
    }

    // 4. Regional Holidays (if HOLIDAY is requested)
    if (sources.includes('HOLIDAY')) {
      const holidayCountry = filters?.holidayCountry || 'EG';
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

      feedPromises.push(
        Promise.all(
          years.map((year) => this.repo.getHolidays(holidayCountry, year)),
        ).then((caches) => {
          const holidayEvents: any[] = [];
          for (const cache of caches) {
            if (!cache) continue;
            const holidays = cache.holidays as Array<{ date: string; name: string }>;
            for (const h of holidays) {
              const hDate = new Date(h.date);
              if (hDate >= startDate && hDate <= endDate) {
                holidayEvents.push({
                  id: `holiday-${cache.country}-${h.date}-${h.name}`,
                  spaceId,
                  title: h.name,
                  description: `${cache.country} Public Holiday`,
                  startDate: hDate,
                  endDate: hDate,
                  allDay: true,
                  calendarType: 'GREGORIAN',
                  hijriDate: this.gregorianToHijri(hDate),
                  source: CalendarEventSource.HOLIDAY,
                  visibility: 'PUBLIC',
                  color: '#e74c3c',
                  metadata: {
                    country: cache.country,
                  },
                });
              }
            }
          }
          return holidayEvents;
        }),
      );
    } else {
      feedPromises.push(Promise.resolve([]));
    }

    const resolvedFeeds = await Promise.all(feedPromises);
    const flattened = resolvedFeeds.reduce((acc, val) => acc.concat(val), []);

    // Sort by startDate ascending
    return flattened.sort(
      (a: any, b: any) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }
}
