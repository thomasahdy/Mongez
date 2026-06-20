import { Test, TestingModule } from '@nestjs/testing';
import { TelegramChannel } from './telegram.channel';
import { TelegramRepository } from '../../telegram/repositories/telegram.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../../infrastructure/queue/queue.constants';

describe('TelegramChannel', () => {
  let channel: TelegramChannel;
  let repo: jest.Mocked<TelegramRepository>;
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
        TelegramChannel,
        { provide: TelegramRepository, useValue: repo },
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(QUEUE_NAMES.TELEGRAM), useValue: queue },
      ],
    }).compile();

    channel = module.get<TelegramChannel>(TelegramChannel);
  });

  it('should skip sending if contact is not registered or opted out', async () => {
    const notification = {
      id: 'notif-1',
      userId: 'user-1',
      spaceId: 'space-1',
      type: 'TASK_UPDATED',
    } as any;

    repo.findContact.mockResolvedValue(null);

    const result1 = await channel.send(notification, {} as any);
    expect(result1).toBe(false);

    repo.findContact.mockResolvedValue({ optedIn: false } as any);
    const result2 = await channel.send(notification, {} as any);
    expect(result2).toBe(false);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('should render content and enqueue job, attaching inline keyboard for approvals', async () => {
    const notification = {
      id: 'notif-999',
      userId: 'user-1',
      spaceId: 'space-1',
      type: 'APPROVAL_REQUESTED',
      title: 'New Approval Request',
      body: 'Thomas wants you to review his task',
      entityType: 'workflow',
      entityId: 'wf-instance-456',
    } as any;

    repo.findContact.mockResolvedValue({
      chatId: '55555',
      optedIn: true,
    } as any);

    prisma.userPreference.findUnique.mockResolvedValue({ language: 'en' });

    const result = await channel.send(notification, {} as any);

    expect(result).toBe(true);
    expect(prisma.userPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { language: true },
    });
    expect(queue.add).toHaveBeenCalledWith(
      JOB_NAMES.SEND_TELEGRAM,
      {
        spaceId: 'space-1',
        userId: 'user-1',
        chatId: '55555',
        text: '✅ Approval requested\nThomas wants you to review his task',
        replyMarkup: {
          inline_keyboard: [
            [
              { text: 'Approve', callback_data: 'approve:wf-instance-456' },
              { text: 'Reject', callback_data: 'reject:wf-instance-456' },
            ],
          ],
        },
        type: 'APPROVAL_REQUESTED',
        notificationId: 'notif-999',
      },
      {
        jobId: 'tg:notif-999',
        removeOnComplete: true,
      },
    );
  });
});
