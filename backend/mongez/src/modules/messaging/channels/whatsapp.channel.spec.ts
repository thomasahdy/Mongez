import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppChannel } from './whatsapp.channel';
import { WhatsAppRepository } from '../../whatsapp/repositories/whatsapp.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';

describe('WhatsAppChannel', () => {
  let channel: WhatsAppChannel;
  let repo: jest.Mocked<WhatsAppRepository>;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    repo = {
      findContact: jest.fn(),
    } as any;

    prisma = {
      userPreference: {
        findUnique: jest.fn(),
      },
    };

    queue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppChannel,
        { provide: WhatsAppRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE_NAMES.WHATSAPP), useValue: queue },
      ],
    }).compile();

    channel = module.get<WhatsAppChannel>(WhatsAppChannel);
  });

  it('should skip sending if contact is not registered, opted out, or not verified', async () => {
    const notification = {
      id: 'notif-1',
      userId: 'user-1',
      spaceId: 'space-1',
      type: 'TASK_UPDATED',
      title: 'Task Title',
      body: 'Task Body',
    } as any;

    repo.findContact.mockResolvedValue(null); // Not registered

    const result1 = await channel.send(notification, {} as any);
    expect(result1).toBe(false);

    repo.findContact.mockResolvedValue({ optedIn: false } as any); // Opted out
    const result2 = await channel.send(notification, {} as any);
    expect(result2).toBe(false);

    repo.findContact.mockResolvedValue({ optedIn: true, isVerified: false } as any); // Not verified
    const result3 = await channel.send(notification, {} as any);
    expect(result3).toBe(false);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should render content and enqueue a BullMQ job on success', async () => {
    const notification = {
      id: 'notif-123',
      userId: 'user-123',
      spaceId: 'space-123',
      type: 'TASK_ASSIGNED',
      title: 'Assigned Task',
      body: 'Thomas assigned you a task',
      entityType: 'task',
      entityId: 'task-1',
      metadata: { importance: 'HIGH' },
    } as any;

    repo.findContact.mockResolvedValue({
      phoneNumber: '+1234567890',
      optedIn: true,
      isVerified: true,
    } as any);

    prisma.userPreference.findUnique.mockResolvedValue({ language: 'en' });

    const result = await channel.send(notification, {} as any);

    expect(result).toBe(true);
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      select: { language: true },
    });
    expect(queue.add).toHaveBeenCalledWith(
      JOB_NAMES.SEND_WHATSAPP,
      {
        spaceId: 'space-123',
        userId: 'user-123',
        toPhone: '+1234567890',
        content: '📋 Task assigned\nAssigned Task was assigned to you.',
        type: 'TASK_ASSIGNED',
        notificationId: 'notif-123',
        entityType: 'task',
        entityId: 'task-1',
        metadata: { importance: 'HIGH' },
      },
      {
        jobId: 'wa:notif-123',
        removeOnComplete: true,
      },
    );
  });

  it('should return false if enqueuing job throws error', async () => {
    const notification = {
      id: 'notif-1',
      userId: 'user-1',
      spaceId: 'space-1',
      type: 'TASK_UPDATED',
    } as any;

    repo.findContact.mockResolvedValue({
      phoneNumber: '+1234567890',
      optedIn: true,
      isVerified: true,
    } as any);

    queue.add.mockRejectedValue(new Error('Queue Error'));

    const result = await channel.send(notification, {} as any);

    expect(result).toBe(false);
  });
});
