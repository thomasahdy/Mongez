import { Test, TestingModule } from '@nestjs/testing';
import { TelegramProcessor } from './telegram.processor';
import { TelegramService } from '../services/telegram.service';
import { TelegramRepository } from '../repositories/telegram.repository';
import { JOB_NAMES } from '../../../infrastructure/queue/queue.constants';

describe('TelegramProcessor', () => {
  let processor: TelegramProcessor;
  let service: jest.Mocked<TelegramService>;
  let repo: jest.Mocked<TelegramRepository>;

  const makeJob = (name: string, data: any) =>
    ({
      name,
      data,
    } as any);

  beforeEach(async () => {
    service = {
      resolveAccount: jest.fn(),
      sendMessage: jest.fn(),
    } as any;

    repo = {
      createMessage: jest.fn(),
      updateMessage: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramProcessor,
        { provide: TelegramService, useValue: service },
        { provide: TelegramRepository, useValue: repo },
      ],
    }).compile();

    processor = module.get<TelegramProcessor>(TelegramProcessor);
  });

  it('should ignore jobs with names other than SEND_TELEGRAM', async () => {
    const job = makeJob('other-job-name', {});
    await processor.process(job);

    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('should skip processing if active space account cannot be resolved', async () => {
    const job = makeJob(JOB_NAMES.SEND_TELEGRAM, { spaceId: 'space-1', chatId: '11111', text: 'Hello' });
    service.resolveAccount.mockResolvedValue(null);

    await processor.process(job);

    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('should send Telegram message and update status to SENT on success', async () => {
    const job = makeJob(JOB_NAMES.SEND_TELEGRAM, {
      spaceId: 'space-1',
      chatId: '11111',
      text: 'Hello Thomas',
      replyMarkup: { inline_keyboard: [] },
      notificationId: 'notif-1',
      type: 'TASK_ASSIGNED',
    });

    const mockAccount = { botToken: 'bot-token-123' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-1', metadata: {} } as any);
    service.sendMessage.mockResolvedValue({ ok: true, tgMessageId: 9999, raw: 'raw-result' });

    await processor.process(job);

    expect(repo.createMessage).toHaveBeenCalledWith({
      spaceId: 'space-1',
      direction: 'OUTBOUND',
      chatId: '11111',
      content: 'Hello Thomas',
      status: 'PENDING',
      metadata: {
        notificationId: 'notif-1',
        type: 'TASK_ASSIGNED',
        hasReplyMarkup: true,
      },
    });

    expect(service.sendMessage).toHaveBeenCalledWith('bot-token-123', '11111', 'Hello Thomas', {
      replyMarkup: { inline_keyboard: [] },
    });

    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-1', {
      status: 'SENT',
      metadata: {
        tgMessageId: 9999,
        raw: 'raw-result',
      },
    });
  });

  it('should update status to FAILED and throw error if sendMessage fails with temporary error', async () => {
    const job = makeJob(JOB_NAMES.SEND_TELEGRAM, {
      spaceId: 'space-1',
      chatId: '11111',
      text: 'Hello Thomas',
    });

    const mockAccount = { botToken: 'bot-token-123' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-1', metadata: {} } as any);
    service.sendMessage.mockResolvedValue({ ok: false, errorCode: '500', raw: 'error-detail' });

    await expect(processor.process(job)).rejects.toThrow('Telegram send failed (code=500)');

    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-1', {
      status: 'FAILED',
      errorCode: '500',
      metadata: { raw: 'error-detail' },
    });
  });

  it('should update status to FAILED and NOT throw error if sendMessage fails with permanent error (e.g. 403)', async () => {
    const job = makeJob(JOB_NAMES.SEND_TELEGRAM, {
      spaceId: 'space-1',
      chatId: '11111',
      text: 'Hello Thomas',
    });

    const mockAccount = { botToken: 'bot-token-123' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-1', metadata: {} } as any);
    service.sendMessage.mockResolvedValue({ ok: false, errorCode: '403', raw: 'error-detail' });

    await expect(processor.process(job)).resolves.not.toThrow();

    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-1', {
      status: 'FAILED',
      errorCode: '403',
      metadata: { raw: 'error-detail' },
    });
  });
});
