import { CalendarService } from './calendar.service';
import { CalendarRepository } from '../repositories/calendar.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CalendarEventSource } from '@prisma/client';

describe('CalendarService', () => {
  let service: CalendarService;
  let repo: jest.Mocked<CalendarRepository>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    repo = {
      createEvent: jest.fn(),
      updateEvent: jest.fn(),
      findEventById: jest.fn(),
      deleteEvent: jest.fn(),
      findEventsForSpace: jest.fn(),
      getHolidays: jest.fn(),
    } as any;

    prisma = {
      task: {
        findMany: jest.fn(),
      },
      workflowInstance: {
        findMany: jest.fn(),
      },
    } as any;

    service = new CalendarService(repo, prisma);
  });

  describe('Hijri Umm al-Qura Conversion', () => {
    it('should correctly format Gregorian date to Hijri Umm al-Qura string', () => {
      // June 20, 2026 is roughly Muharram 5, 1448
      const date = new Date('2026-06-20T10:00:00Z');
      const hijriStr = service.gregorianToHijri(date);

      expect(hijriStr).toBe('1448-01-05');
    });

    it('should convert Hijri Umm al-Qura string back to Gregorian date', () => {
      const hijriStr = '1448-01-05';
      const date = service.hijriToGregorian(hijriStr);

      expect(date).toBeInstanceOf(Date);
      expect(service.gregorianToHijri(date)).toBe(hijriStr);
    });

    it('should return empty string or fallback date on error', () => {
      expect(service.gregorianToHijri(null as any)).toBe('');
      const fallback = service.hijriToGregorian('invalid-hijri-format');
      expect(fallback).toBeInstanceOf(Date);
    });
  });

  describe('Event CRUD', () => {
    it('should create an event with automatically calculated Hijri date', async () => {
      const dto = {
        title: 'Meeting',
        description: 'Sync',
        startDate: '2026-06-20T10:00:00Z',
        endDate: '2026-06-20T11:00:00Z',
        allDay: false,
        calendarType: 'GREGORIAN',
        visibility: 'PUBLIC' as any,
        participants: ['test@example.com'],
      };

      repo.createEvent.mockResolvedValue({ id: 'event-1', ...dto, hijriDate: '1448-01-05' } as any);

      const result = await service.createEvent('space-1', 'user-1', dto);

      expect(repo.createEvent).toHaveBeenCalledWith('space-1', 'user-1', {
        ...dto,
        hijriDate: '1448-01-05',
      });
      expect(result.id).toBe('event-1');
    });

    it('should update an event and recalculate Hijri date if startDate changes', async () => {
      const dto = {
        title: 'Updated Meeting',
        startDate: '2026-06-20T10:00:00Z',
      };

      repo.updateEvent.mockResolvedValue({ id: 'event-1', ...dto, hijriDate: '1448-01-05' } as any);

      const result = await service.updateEvent('event-1', 'space-1', dto);

      expect(repo.updateEvent).toHaveBeenCalledWith('event-1', 'space-1', {
        ...dto,
        hijriDate: '1448-01-05',
      });
      expect(result.id).toBe('event-1');
    });

    it('should retrieve event by ID', async () => {
      repo.findEventById.mockResolvedValue({ id: 'event-1' } as any);
      const result = await service.getEventById('event-1', 'space-1');
      expect(result).toEqual({ id: 'event-1' });
    });

    it('should delete event', async () => {
      repo.deleteEvent.mockResolvedValue({ count: 1 } as any);
      const result = await service.deleteEvent('event-1', 'space-1');
      expect(result).toEqual({ count: 1 });
    });
  });

  describe('getUnifiedFeed()', () => {
    it('should pull database events, tasks, approvals, and regional holidays correctly', async () => {
      // Mock db events
      repo.findEventsForSpace.mockResolvedValue([
        {
          id: 'db-event-1',
          title: 'Design Sync',
          startDate: new Date('2026-06-20T09:00:00Z'),
          source: CalendarEventSource.MONGEZ,
        },
      ] as any);

      // Mock tasks
      prisma.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          title: 'Code review task',
          description: 'Review PR',
          startDate: new Date('2026-06-20T10:00:00Z'),
          dueDate: new Date('2026-06-20T18:00:00Z'),
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          identifier: 'EDU-42',
          assignments: [
            {
              user: { id: 'user-2', email: 'user2@example.com', name: 'User Two', avatarUrl: null },
            },
          ],
        },
      ] as any);

      // Mock workflow approvals
      prisma.workflowInstance.findMany.mockResolvedValue([
        {
          id: 'wf-1',
          status: 'PENDING',
          startedAt: new Date('2026-06-19T00:00:00Z'),
          context: { _approvalExpiresAt: '2026-06-20T12:00:00Z' },
          definition: { name: 'Leave Request' },
          requester: { id: 'user-3', email: 'user3@example.com', name: 'User Three', avatarUrl: null },
        },
      ] as any);

      // Mock holidays cache for EG 2026
      repo.getHolidays.mockResolvedValue({
        country: 'EG',
        year: 2026,
        holidays: [
          { date: '2026-06-20', name: 'Revolution Day' },
        ],
      } as any);

      const feed = await service.getUnifiedFeed(
        'space-1',
        '2026-06-20T00:00:00Z',
        '2026-06-20T23:59:59Z',
        'user-1',
        {
          sources: ['MONGEZ', 'HOLIDAY', 'APPROVAL'],
          holidayCountry: 'EG',
        },
      );

      // Feed should contain:
      // 1. DB event (Design Sync)
      // 2. Task (Code review task)
      // 3. Workflow instance (Leave Request approval)
      // 4. Holiday event (Revolution Day)
      // All sorted by startDate ascending
      expect(feed).toHaveLength(4);

      // Assert sources
      expect(feed.map((e) => e.id)).toEqual([
        expect.stringContaining('holiday'),
        'db-event-1',
        'task-task-1',
        'workflow-wf-1',
      ]);

      expect(feed[0].title).toBe('Revolution Day');
      expect(feed[0].source).toBe(CalendarEventSource.HOLIDAY);

      expect(feed[2].title).toBe('Code review task');
      expect(feed[2].source).toBe(CalendarEventSource.MONGEZ);

      expect(feed[3].title).toBe('Approval: Leave Request');
      expect(feed[3].source).toBe(CalendarEventSource.APPROVAL);
    });

    it('should skip database events and other sources if not specified in the sources filter', async () => {
      repo.findEventsForSpace.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.workflowInstance.findMany.mockResolvedValue([]);
      repo.getHolidays.mockResolvedValue({
        country: 'EG',
        year: 2026,
        holidays: [{ date: '2026-06-20', name: 'Revolution Day' }],
      } as any);

      const feed = await service.getUnifiedFeed(
        'space-1',
        '2026-06-20T00:00:00Z',
        '2026-06-20T23:59:59Z',
        'user-1',
        {
          sources: ['HOLIDAY'],
          holidayCountry: 'EG',
        },
      );

      expect(feed).toHaveLength(1);
      expect(feed[0].title).toBe('Revolution Day');
      expect(repo.findEventsForSpace).not.toHaveBeenCalled();
      expect(prisma.task.findMany).not.toHaveBeenCalled();
      expect(prisma.workflowInstance.findMany).not.toHaveBeenCalled();
    });

    it('should handle workflow instances with overdue status and map them to ESCALATION', async () => {
      repo.findEventsForSpace.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.workflowInstance.findMany.mockResolvedValue([
        {
          id: 'wf-overdue',
          status: 'PENDING',
          startedAt: new Date('2026-06-10T00:00:00Z'),
          context: { _approvalExpiresAt: '2026-06-15T00:00:00Z' }, // expired
          definition: { name: 'Urgent Budget Request' },
          requester: { id: 'user-3', email: 'user3@example.com', name: 'User Three', avatarUrl: null },
        },
      ] as any);

      const feed = await service.getUnifiedFeed(
        'space-1',
        '2026-06-10T00:00:00Z',
        '2026-06-25T00:00:00Z',
        'user-1',
        {
          sources: ['ESCALATION'],
        },
      );

      expect(feed).toHaveLength(1);
      expect(feed[0].title).toBe('🚨 OVERDUE: Urgent Budget Request');
      expect(feed[0].source).toBe(CalendarEventSource.ESCALATION);
    });

    it('should handle null/missing holiday cache gracefully', async () => {
      repo.findEventsForSpace.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.workflowInstance.findMany.mockResolvedValue([]);
      repo.getHolidays.mockResolvedValue(null as any);

      const feed = await service.getUnifiedFeed(
        'space-1',
        '2026-06-20T00:00:00Z',
        '2026-06-20T23:59:59Z',
        'user-1',
        {
          sources: ['HOLIDAY'],
          holidayCountry: 'EG',
        },
      );

      expect(feed).toHaveLength(0);
    });
  });
});
