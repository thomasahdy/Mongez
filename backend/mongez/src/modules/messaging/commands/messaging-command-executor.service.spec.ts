import { Test, TestingModule } from '@nestjs/testing';
import { MessagingCommandExecutor, InboundMessage } from './messaging-command-executor.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { TasksService } from '../../tasks/tasks.service';
import { WorkflowService } from '../../workflow/workflow.service';
import { MessagingIntentService } from './messaging-intent.service';
import { MessagingApprovalService } from '../approvals/messaging-approval.service';
import { ApprovalDelegationService } from '../approvals/approval-delegation.service';
import { MessagingAuditService } from './messaging-audit.service';
import { MessagingRateLimitGuard } from './guards/messaging-rate-limit.guard';
import { CacheService } from '../../../infrastructure/cache/cache.service';

describe('MessagingCommandExecutor', () => {
  let executor: MessagingCommandExecutor;
  let rateLimiter: jest.Mocked<MessagingRateLimitGuard>;
  let approvals: jest.Mocked<MessagingApprovalService>;
  let audit: jest.Mocked<MessagingAuditService>;
  let intent: jest.Mocked<MessagingIntentService>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockRateLimiter = {
      checkRateLimit: jest.fn(),
    };
    const mockApprovals = {
      resolve: jest.fn(),
    };
    const mockAudit = {
      recordAction: jest.fn(),
    };
    const mockIntent = {
      parse: jest.fn(),
    };
    const mockDelegation = {
      resolveEffectiveReviewer: jest.fn(),
      createDelegation: jest.fn(),
      findActiveDelegate: jest.fn(),
    };
    const mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };
    const mockPrisma = {
      userPreference: {
        findUnique: jest.fn().mockResolvedValue({ language: 'en' }),
      },
      workflowInstance: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingCommandExecutor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TasksService, useValue: {} },
        { provide: WorkflowService, useValue: { getPendingForReviewer: jest.fn().mockResolvedValue({ data: [] }) } },
        { provide: MessagingIntentService, useValue: mockIntent },
        { provide: MessagingApprovalService, useValue: mockApprovals },
        { provide: ApprovalDelegationService, useValue: mockDelegation },
        { provide: MessagingAuditService, useValue: mockAudit },
        { provide: MessagingRateLimitGuard, useValue: mockRateLimiter },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();

    executor = module.get<MessagingCommandExecutor>(MessagingCommandExecutor);
    rateLimiter = module.get(MessagingRateLimitGuard);
    approvals = module.get(MessagingApprovalService);
    audit = module.get(MessagingAuditService);
    intent = module.get(MessagingIntentService);
    prisma = module.get(PrismaService);
  });

  describe('Rate Limiting', () => {
    it('should reject inbound command and return warning when rate limit is exceeded', async () => {
      rateLimiter.checkRateLimit.mockResolvedValue(false);

      const msgPayload: InboundMessage = {
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '/tasks',
      };

      const result = await executor.handleInbound(msgPayload);

      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('user-1');
      expect(result.reply).toContain('Rate limit exceeded');
      expect(intent.parse).not.toHaveBeenCalled();
    });

    it('should proceed with inbound command when rate limit is not exceeded', async () => {
      rateLimiter.checkRateLimit.mockResolvedValue(true);
      intent.parse.mockResolvedValue({ type: 'HELP', raw: '/help' });

      const msgPayload: InboundMessage = {
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '/help',
      };

      const result = await executor.handleInbound(msgPayload);

      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('user-1');
      expect(intent.parse).toHaveBeenCalledWith('/help');
      expect(result.reply).toContain('Mongez commands');
    });
  });

  describe('Audit Logging', () => {
    it('should record audit action for approvals resolved via button callbacks', async () => {
      rateLimiter.checkRateLimit.mockResolvedValue(true);
      approvals.resolve.mockResolvedValue({ ok: true, reply: 'Approved successfully' });

      const msgPayload: InboundMessage = {
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '',
        callbackPayload: 'approve:instance-123',
      };

      const result = await executor.handleInbound(msgPayload);

      expect(approvals.resolve).toHaveBeenCalledWith('instance-123', 'user-1', 'APPROVED', 'en');
      expect(audit.recordAction).toHaveBeenCalledWith({
        userId: 'user-1',
        spaceId: 'space-1',
        action: 'workflow.approved',
        entityType: 'WorkflowInstance',
        entityId: 'instance-123',
        channel: 'TELEGRAM',
      });
      expect(result.reply).toBe('Approved successfully');
      expect(result.callbackAnswer).toBe('Approved successfully');
    });

    it('should record audit action for rejections resolved via button callbacks', async () => {
      rateLimiter.checkRateLimit.mockResolvedValue(true);
      approvals.resolve.mockResolvedValue({ ok: true, reply: 'Rejected successfully' });

      const msgPayload: InboundMessage = {
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '',
        callbackPayload: 'reject:instance-123',
      };

      const result = await executor.handleInbound(msgPayload);

      expect(approvals.resolve).toHaveBeenCalledWith('instance-123', 'user-1', 'REJECTED', 'en');
      expect(audit.recordAction).toHaveBeenCalledWith({
        userId: 'user-1',
        spaceId: 'space-1',
        action: 'workflow.rejected',
        entityType: 'WorkflowInstance',
        entityId: 'instance-123',
        channel: 'TELEGRAM',
      });
    });

    it('should record audit action when resolved via text command /approve', async () => {
      rateLimiter.checkRateLimit.mockResolvedValue(true);
      intent.parse.mockResolvedValue({ type: 'APPROVE', id: 'inst-123', raw: '/approve inst-123' });
      prisma.workflowInstance.findFirst.mockResolvedValue({ id: 'inst-123' } as any);
      approvals.resolve.mockResolvedValue({ ok: true, reply: 'Approved successfully' });

      const msgPayload: InboundMessage = {
        channel: 'TELEGRAM',
        spaceId: 'space-1',
        userId: 'user-1',
        text: '/approve inst-123',
      };

      await executor.handleInbound(msgPayload);

      expect(audit.recordAction).toHaveBeenCalledWith({
        userId: 'user-1',
        spaceId: 'space-1',
        action: 'workflow.approved',
        entityType: 'WorkflowInstance',
        entityId: 'inst-123',
        channel: 'TELEGRAM',
      });
    });
  });
});
