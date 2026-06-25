import { MeetingsService } from './meetings.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ApprovalStatus } from '@prisma/client';

describe('MeetingsService', () => {
  let service: MeetingsService;
  let prisma: jest.Mocked<PrismaService>;
  let storage: jest.Mocked<StorageService>;
  let tasksService: jest.Mocked<TasksService>;
  let httpService: jest.Mocked<HttpService>;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    prisma = {
      meeting: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      proposedTask: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      space: {
        findUnique: jest.fn(),
      },
      membership: {
        findUnique: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
    } as any;

    storage = {
      buildKey: jest.fn((spaceId, type, name, file) => `${spaceId}/${type}/${file}`),
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      download: jest.fn().mockResolvedValue(Buffer.from('transcript text', 'utf-8')),
    } as any;

    tasksService = {
      createTask: jest.fn().mockResolvedValue({ id: 'task-123' }),
    } as any;

    httpService = {
      post: jest.fn(),
    } as any;

    config = {
      get: jest.fn().mockReturnValue('mock-val'),
    } as any;

    service = new MeetingsService(prisma, storage, tasksService, httpService, config);
  });

  describe('listMeetings()', () => {
    it('should list all meetings in a space sorted by creation date', async () => {
      const mockList = [{ id: 'm-1' }];
      prisma.meeting.findMany.mockResolvedValue(mockList as any);

      const result = await service.listMeetings('space-1');

      expect(prisma.meeting.findMany).toHaveBeenCalledWith({
        where: { spaceId: 'space-1' },
        include: { proposedTasks: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockList);
    });
  });

  describe('getMeeting()', () => {
    it('should throw NotFoundException if meeting does not exist', async () => {
      prisma.meeting.findFirst.mockResolvedValue(null);

      await expect(service.getMeeting('m-1', 'space-1')).rejects.toThrow(NotFoundException);
    });

    it('should return meeting if found', async () => {
      const mockM = { id: 'm-1' };
      prisma.meeting.findFirst.mockResolvedValue(mockM as any);

      const result = await service.getMeeting('m-1', 'space-1');
      expect(result).toEqual(mockM);
    });
  });

  describe('uploadMeeting()', () => {
    const mockFile = {
      originalname: 'audio.mp3',
      mimetype: 'audio/mpeg',
      buffer: Buffer.from('audio-data'),
      size: 100,
    } as any;

    it('should throw BadRequestException if no file is provided', async () => {
      await expect(service.uploadMeeting('space-1', 'user-1', 'Title', null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should upload audio, call AI service, save transcript, and seed proposed tasks', async () => {
      const aiResponse = {
        transcript: 'This is a meeting transcript text.',
        summary: {
          title: 'AI Summary Title',
          description: 'AI summary description',
          action_items: [
            { title: 'Task 1', description: 'desc 1', assignee_email: 'assignee@example.com', due_date: '2026-06-25' },
          ],
        },
      };

      httpService.post.mockReturnValue(of({ data: aiResponse }) as any);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-assignee' } as any);
      prisma.meeting.create.mockResolvedValue({ id: 'meeting-1' } as any);
      prisma.meeting.findUnique.mockResolvedValue({ id: 'meeting-1', proposedTasks: [] } as any);

      const result = await service.uploadMeeting('space-1', 'user-1', 'Original Title', mockFile);

      expect(storage.upload).toHaveBeenCalledTimes(2); // 1. audio, 2. transcript
      expect(httpService.post).toHaveBeenCalled();
      expect(prisma.proposedTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meetingId: 'meeting-1',
          title: 'Task 1',
          assigneeId: 'user-assignee',
        }),
      });
      expect(result).toBeDefined();
    });

    it('should clean up uploaded audio from S3 and throw if AI call fails', async () => {
      httpService.post.mockReturnValue(throwError(() => new Error('FastAPI Down')) as any);

      await expect(service.uploadMeeting('space-1', 'user-1', 'Title', mockFile)).rejects.toThrow(
        BadRequestException,
      );
      // Verify cleanup delete is called on S3 key
      expect(storage.delete).toHaveBeenCalled();
    });

    it('should throw immediately and not call AI if initial audio upload to S3 fails', async () => {
      storage.upload.mockRejectedValueOnce(new Error('S3 Connection Timed Out'));

      await expect(service.uploadMeeting('space-1', 'user-1', 'Title', mockFile)).rejects.toThrow(
        'S3 Connection Timed Out',
      );
      expect(httpService.post).not.toHaveBeenCalled();
    });

    it('should proceed and set assigneeId to null if the assignee email in action item does not exist in the database', async () => {
      const aiResponse = {
        transcript: 'Transcript text.',
        summary: {
          title: 'Title',
          description: 'Desc',
          action_items: [
            { title: 'Task 1', description: 'desc 1', assignee_email: 'unknown@example.com', due_date: '2026-06-25' },
          ],
        },
      };

      httpService.post.mockReturnValue(of({ data: aiResponse }) as any);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.meeting.create.mockResolvedValue({ id: 'meeting-1' } as any);
      prisma.meeting.findUnique.mockResolvedValue({ id: 'meeting-1', proposedTasks: [] } as any);

      await service.uploadMeeting('space-1', 'user-1', 'Title', mockFile);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'unknown@example.com' }, select: { id: true } });
      expect(prisma.proposedTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meetingId: 'meeting-1',
          title: 'Task 1',
          assigneeId: null,
        }),
      });
    });

    it('should cleanup audio and propagate the specific error message when AI call fails with response details', async () => {
      const apiErrorResponse = {
        response: {
          data: {
            detail: 'Audio format not supported by model',
          },
        },
      };
      httpService.post.mockReturnValue(throwError(() => apiErrorResponse) as any);

      await expect(service.uploadMeeting('space-1', 'user-1', 'Title', mockFile)).rejects.toThrow(
        'Audio format not supported by model',
      );
      expect(storage.delete).toHaveBeenCalled();
    });
  });

  describe('approveProposedTask()', () => {
    it('should throw NotFoundException if proposed task not found', async () => {
      prisma.proposedTask.findFirst.mockResolvedValue(null);

      await expect(
        service.approveProposedTask('task-id', 'space-1', 'user-1', 'board-1', 'col-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if proposed task is not pending', async () => {
      prisma.proposedTask.findFirst.mockResolvedValue({
        id: 'pt-1',
        status: ApprovalStatus.APPROVED,
      } as any);

      await expect(
        service.approveProposedTask('pt-1', 'space-1', 'user-1', 'board-1', 'col-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create actual task and update proposed task status to APPROVED', async () => {
      prisma.proposedTask.findFirst.mockResolvedValue({
        id: 'pt-1',
        status: ApprovalStatus.PENDING,
        title: 'Draft proposal',
        description: 'Detail it',
        assigneeId: 'user-2',
        dueDate: new Date('2026-06-25'),
      } as any);

      prisma.space.findUnique.mockResolvedValue({ prefix: 'NGO' } as any);
      prisma.proposedTask.update.mockResolvedValue({ id: 'pt-1', status: ApprovalStatus.APPROVED } as any);

      const result = await service.approveProposedTask('pt-1', 'space-1', 'user-1', 'board-1', 'col-1');

      expect(tasksService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Draft proposal',
          boardId: 'board-1',
          columnId: 'col-1',
          spaceId: 'space-1',
        }),
        'user-1',
        'space-1',
        'NGO',
      );

      expect(prisma.proposedTask.update).toHaveBeenCalledWith({
        where: { id: 'pt-1' },
        data: {
          status: ApprovalStatus.APPROVED,
          taskId: 'task-123',
        },
      });
      expect(result.status).toBe(ApprovalStatus.APPROVED);
    });
  });

  describe('rejectProposedTask()', () => {
    it('should throw NotFoundException if proposed task not found', async () => {
      prisma.proposedTask.findFirst.mockResolvedValue(null);
      await expect(service.rejectProposedTask('pt-1', 'space-1')).rejects.toThrow(NotFoundException);
    });

    it('should update status to REJECTED if task is pending', async () => {
      prisma.proposedTask.findFirst.mockResolvedValue({
        id: 'pt-1',
        status: ApprovalStatus.PENDING,
      } as any);

      prisma.proposedTask.update.mockResolvedValue({ id: 'pt-1', status: ApprovalStatus.REJECTED } as any);

      const result = await service.rejectProposedTask('pt-1', 'space-1');

      expect(prisma.proposedTask.update).toHaveBeenCalledWith({
        where: { id: 'pt-1' },
        data: { status: ApprovalStatus.REJECTED },
      });
      expect(result.status).toBe(ApprovalStatus.REJECTED);
    });
  });

  describe('getTranscript()', () => {
    it('should retrieve meeting transcript from storage', async () => {
      prisma.meeting.findFirst.mockResolvedValue({
        id: 'm-1',
        transcriptUrl: 'space-1/meetings/transcript.txt',
      } as any);

      const result = await service.getTranscript('m-1', 'space-1');

      expect(storage.download).toHaveBeenCalledWith('space-1/meetings/transcript.txt');
      expect(result.transcript).toBe('transcript text');
    });
  });
});
