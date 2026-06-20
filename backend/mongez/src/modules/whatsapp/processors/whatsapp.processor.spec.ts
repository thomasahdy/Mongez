import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppService } from '../services/whatsapp.service';
import { WhatsAppRepository } from '../repositories/whatsapp.repository';
import { JOB_NAMES } from '../../../infrastructure/queue/queue.constants';

describe('WhatsAppProcessor', () => {
  let processor: WhatsAppProcessor;
  let service: jest.Mocked<WhatsAppService>;
  let repo: jest.Mocked<WhatsAppRepository>;

  const makeJob = (name: string, data: any) =>
    ({
      name,
      data,
    } as any);

  beforeEach(async () => {
    service = {
      resolveAccount: jest.fn(),
      sendInteractiveButtons: jest.fn(),
      sendTemplate: jest.fn(),
      sendText: jest.fn(),
    } as any;

    repo = {
      findContact: jest.fn(),
      createMessage: jest.fn(),
      updateMessage: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProcessor,
        { provide: WhatsAppService, useValue: service },
        { provide: WhatsAppRepository, useValue: repo },
      ],
    }).compile();

    processor = module.get<WhatsAppProcessor>(WhatsAppProcessor);
  });

  it('should ignore jobs with names other than SEND_WHATSAPP', async () => {
    const job = makeJob('other-job-name', {});
    await processor.process(job);

    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('should skip processing if recipient phone number cannot be resolved', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, { spaceId: 'space-1', userId: 'user-1' });
    repo.findContact.mockResolvedValue(null); // No phone found

    await processor.process(job);

    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('should skip processing if active space account cannot be resolved', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, { spaceId: 'space-1', toPhone: '+1234567890' });
    service.resolveAccount.mockResolvedValue(null); // No account

    await processor.process(job);

    expect(repo.createMessage).not.toHaveBeenCalled();
  });

  it('should process interactive buttons and save status SENT on success', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, {
      spaceId: 'space-1',
      toPhone: '+1234567890',
      interactive: {
        bodyText: 'Approve?',
        buttons: [{ id: 'btn-1', title: 'Approve' }],
      },
    });

    const mockAccount = { spaceId: 'space-1' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-1' } as any);
    service.sendInteractiveButtons.mockResolvedValue({ status: 'SENT', waMessageId: 'wa-msg-id-1' });

    await processor.process(job);

    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING',
        content: 'Approve?',
      }),
    );
    expect(service.sendInteractiveButtons).toHaveBeenCalledWith(
      mockAccount,
      '+1234567890',
      'Approve?',
      [{ id: 'btn-1', title: 'Approve' }],
    );
    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-1', {
      status: 'SENT',
      waMessageId: 'wa-msg-id-1',
      metadata: expect.any(Object),
    });
  });

  it('should process approval template and fall back to plain text if template fails', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, {
      spaceId: 'space-1',
      toPhone: '+1234567890',
      type: 'APPROVAL_REQUESTED',
      content: 'FallBack plain text content',
      metadata: {
        title: 'My Workflow',
        body: 'Approved by Thomas',
        actorName: 'Thomas',
      },
    });

    const mockAccount = { spaceId: 'space-1' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-2' } as any);
    // Template fails, but text succeeds
    service.sendTemplate.mockResolvedValue({ status: 'FAILED', errorCode: '132000' });
    service.sendText.mockResolvedValue({ status: 'SENT', waMessageId: 'wa-fallback-id' });

    await processor.process(job);

    expect(service.sendTemplate).toHaveBeenCalledWith(
      mockAccount,
      '+1234567890',
      'approval_request',
      undefined,
      ['My Workflow', 'Approved by Thomas', 'Thomas'],
    );
    expect(service.sendText).toHaveBeenCalledWith(mockAccount, '+1234567890', 'FallBack plain text content');
    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-2', {
      status: 'SENT',
      waMessageId: 'wa-fallback-id',
      metadata: expect.any(Object),
    });
  });

  it('should process task notification template and fall back to plain text if template fails', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, {
      spaceId: 'space-1',
      toPhone: '+1234567890',
      type: 'TASK_ASSIGNED',
      content: 'Task content',
      metadata: {
        boardName: 'Design Board',
        title: 'Task-123',
        dueDate: 'Tomorrow',
        actorName: 'Thomas',
      },
    });

    const mockAccount = { spaceId: 'space-1' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-3' } as any);
    service.sendTemplate.mockResolvedValue({ status: 'FAILED', errorCode: '132000' });
    service.sendText.mockResolvedValue({ status: 'SENT', waMessageId: 'wa-fallback-id' });

    await processor.process(job);

    expect(service.sendTemplate).toHaveBeenCalledWith(
      mockAccount,
      '+1234567890',
      'task_notification',
      undefined,
      ['Design Board', 'Task-123', 'Tomorrow', 'Thomas'],
    );
    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-3', {
      status: 'SENT',
      waMessageId: 'wa-fallback-id',
      metadata: expect.any(Object),
    });
  });

  it('should process otp_verification template and route correctly', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, {
      spaceId: 'space-1',
      toPhone: '+1234567890',
      type: 'otp_verification',
      content: 'Your OTP is 123456',
    });

    const mockAccount = { spaceId: 'space-1' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-4' } as any);
    service.sendTemplate.mockResolvedValue({ status: 'SENT', waMessageId: 'wa-otp-id' });

    await processor.process(job);

    expect(service.sendTemplate).toHaveBeenCalledWith(
      mockAccount,
      '+1234567890',
      'otp_verification',
      'Your OTP is 123456',
    );
    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-4', {
      status: 'SENT',
      waMessageId: 'wa-otp-id',
      metadata: expect.any(Object),
    });
  });

  it('should mark job as FAILED and throw error if Meta API send fails completely', async () => {
    const job = makeJob(JOB_NAMES.SEND_WHATSAPP, {
      spaceId: 'space-1',
      toPhone: '+1234567890',
      content: 'Simple text message',
    });

    const mockAccount = { spaceId: 'space-1' } as any;
    service.resolveAccount.mockResolvedValue(mockAccount);
    repo.createMessage.mockResolvedValue({ id: 'msg-id-fail' } as any);
    service.sendText.mockResolvedValue({ status: 'FAILED', errorCode: 'SOME_API_ERROR' });

    await expect(processor.process(job)).rejects.toThrow('WhatsApp send failed (code=SOME_API_ERROR)');

    expect(repo.updateMessage).toHaveBeenCalledWith('msg-id-fail', {
      status: 'FAILED',
      errorCode: 'SOME_API_ERROR',
      metadata: expect.any(Object),
    });
  });
});
