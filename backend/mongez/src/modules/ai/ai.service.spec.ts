import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIGatewayService } from './ai-gateway.service';
import { AIRequestRepository } from './repositories/ai-request.repository';
import { AIActionRepository } from './repositories/ai-action.repository';
import { AIChatSessionRepository } from './repositories/ai-chat-session.repository';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('AIService', () => {
  let service: AIService;
  let aiGateway: jest.Mocked<AIGatewayService>;
  let requestRepo: jest.Mocked<AIRequestRepository>;
  let actionRepo: jest.Mocked<AIActionRepository>;
  let chatSessionRepo: jest.Mocked<AIChatSessionRepository>;
  let cache: jest.Mocked<CacheService>;
  let prisma: jest.Mocked<PrismaService>;

  const userId = 'user-1';
  const chatDto = { spaceId: 'space-1', message: 'Summarize risks' } as any;
  const riskDto = { spaceId: 'space-1' } as any;
  const reportDto = { spaceId: 'space-1' } as any;

  beforeEach(() => {
    aiGateway = {
      chat: jest.fn(),
      streamChat: jest.fn(),
      analyzeRisk: jest.fn(),
      generateReport: jest.fn(),
      executeApprovedAction: jest.fn(),
      indexDocument: jest.fn(),
      retrieveContext: jest.fn(),
    } as any;

    requestRepo = {
      findByTraceId: jest.fn(),
      findByUser: jest.fn(),
      update: jest.fn(),
    } as any;

    actionRepo = {
      findPending: jest.fn(),
      findById: jest.fn(),
      reject: jest.fn(),
    } as any;

    chatSessionRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    cache = {
      delPattern: jest.fn().mockResolvedValue(undefined),
    } as any;

    prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 'user-1',
          spaceId: 'space-1',
          role: { name: 'OWNER', permissions: [] },
        } as any),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      workflowInstance: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      proposedTask: {
        count: jest.fn().mockResolvedValue(0),
      },
      board: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      decisionRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      meeting: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    // Set up default behavior for actionRepo
    actionRepo.findById.mockResolvedValue({ id: 'action-1', spaceId: 'space-1' } as any);

    service = new AIService(aiGateway, requestRepo, actionRepo, cache, prisma, chatSessionRepo);
  });

  // ─── chat / chatStream ───────────────────────────────────────

  describe('chat()', () => {
    it('UT-AI-SVC-001: should delegate chat to AIGatewayService', async () => {
      const mockResponse = { response: 'There are 3 at-risk tasks.', traceId: 'trace-1' };
      aiGateway.chat.mockResolvedValue(mockResponse);

      const result = await service.chat(userId, chatDto);

      expect(aiGateway.chat).toHaveBeenCalledWith(userId, chatDto);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('chatStream()', () => {
    it('UT-AI-SVC-002: should delegate stream chat to AIGatewayService', async () => {
      const mockStream = { traceId: 'trace-1', stream: {} as any };
      aiGateway.streamChat.mockResolvedValue(mockStream);

      const result = await service.chatStream(userId, chatDto);

      expect(aiGateway.streamChat).toHaveBeenCalledWith(userId, chatDto);
      expect(result).toEqual(mockStream);
    });
  });

  // ─── analyzeRisk ─────────────────────────────────────────────

  describe('analyzeRisk()', () => {
    it('UT-AI-SVC-003: should delegate risk analysis to AIGatewayService', async () => {
      const mockRisk = { risks: [], traceId: 'trace-2' };
      aiGateway.analyzeRisk.mockResolvedValue(mockRisk);

      const result = await service.analyzeRisk(userId, riskDto);

      expect(aiGateway.analyzeRisk).toHaveBeenCalledWith(userId, riskDto);
      expect(result).toEqual(mockRisk);
    });
  });

  // ─── generateReport ──────────────────────────────────────────

  describe('generateReport()', () => {
    it('UT-AI-SVC-004: should delegate report generation to AIGatewayService', async () => {
      const mockReport = { report: '# Status Report', traceId: 'trace-3' };
      aiGateway.generateReport.mockResolvedValue(mockReport);

      const result = await service.generateReport(userId, reportDto);

      expect(aiGateway.generateReport).toHaveBeenCalledWith(userId, reportDto);
      expect(result).toEqual(mockReport);
    });
  });

  // ─── getPendingActions ───────────────────────────────────────

  describe('getPendingActions()', () => {
    it('should return pending AI actions for space', async () => {
      actionRepo.findPending.mockResolvedValue([{ id: 'action-1' }] as any);

      const result = await service.getPendingActions('space-1', userId);

      expect(actionRepo.findPending).toHaveBeenCalledWith('space-1');
      expect(result).toHaveLength(1);
    });
  });

  // ─── approveAction / rejectAction ────────────────────────────

  describe('approveAction()', () => {
    it('should delegate to gateway.executeApprovedAction', async () => {
      const mockExecResult = { success: true };
      aiGateway.executeApprovedAction.mockResolvedValue(mockExecResult as any);

      const result = await service.approveAction('action-1', 'reviewer-1', {} as any);

      expect(aiGateway.executeApprovedAction).toHaveBeenCalledWith('action-1', 'reviewer-1');
      expect(result).toEqual(mockExecResult);
    });

    it('should throw ForbiddenException if user is a regular MEMBER and has no permissions', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'reviewer-1',
        spaceId: 'space-1',
        role: { name: 'MEMBER', permissions: [] },
      } as any);

      await expect(
        service.approveAction('action-1', 'reviewer-1', {} as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('rejectAction()', () => {
    it('should throw NotFoundException when action not found', async () => {
      actionRepo.findById.mockResolvedValue(null);

      await expect(service.rejectAction('bad-action', 'reviewer-1', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject action and record reviewer note', async () => {
      // Restore default mock in case it was altered
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'reviewer-1',
        spaceId: 'space-1',
        role: { name: 'OWNER', permissions: [] },
      } as any);
      actionRepo.findById.mockResolvedValue({ id: 'action-1', spaceId: 'space-1' } as any);
      actionRepo.reject.mockResolvedValue({ id: 'action-1', status: 'REJECTED' } as any);

      await service.rejectAction('action-1', 'reviewer-1', { reviewNote: 'Not safe' } as any);

      expect(actionRepo.reject).toHaveBeenCalledWith('action-1', 'reviewer-1', 'Not safe');
    });

    it('should throw ForbiddenException if user is a regular MEMBER and has no permissions', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'reviewer-1',
        spaceId: 'space-1',
        role: { name: 'MEMBER', permissions: [] },
      } as any);
      actionRepo.findById.mockResolvedValue({ id: 'action-1', spaceId: 'space-1' } as any);

      await expect(
        service.rejectAction('action-1', 'reviewer-1', { reviewNote: 'Not safe' } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── submitFeedback ──────────────────────────────────────────

  describe('submitFeedback()', () => {
    it('should throw NotFoundException when AI request traceId not found', async () => {
      requestRepo.findByTraceId.mockResolvedValue(null);

      await expect(
        service.submitFeedback({ traceId: 'missing-trace', rating: 5 } as any, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update AI request with feedback rating and note', async () => {
      requestRepo.findByTraceId.mockResolvedValue({ traceId: 'trace-1', spaceId: 'space-1' } as any);
      requestRepo.update.mockResolvedValue({ traceId: 'trace-1', userFeedback: 5 } as any);

      await service.submitFeedback({ traceId: 'trace-1', rating: 5, note: 'Great!' } as any, userId);

      expect(requestRepo.update).toHaveBeenCalledWith('trace-1', {
        userFeedback: 5,
        feedbackNote: 'Great!',
      });
    });
  });

  // ─── invalidateCacheForSpace ─────────────────────────────────

  describe('invalidateCacheForSpace()', () => {
    it('UT-AI-SVC-005: should invalidate chat and risk cache patterns for space', async () => {
      await service.invalidateCacheForSpace('space-1');

      expect(cache.delPattern).toHaveBeenCalledWith('ai:chat:space-1:*');
      expect(cache.delPattern).toHaveBeenCalledWith('ai:risk:space-1:*');
    });
  });

  // ─── getHistory ──────────────────────────────────────────────

  describe('getHistory()', () => {
    it('should return paginated AI request history for user', async () => {
      requestRepo.findByUser.mockResolvedValue([{ traceId: 't1' }] as any);

      const result = await service.getHistory(userId, 1, 20);

      expect(requestRepo.findByUser).toHaveBeenCalledWith(userId, 1, 20);
      expect(result).toHaveLength(1);
    });
  });

  // ─── getDashboard ────────────────────────────────────────────

  describe('getDashboard()', () => {
    it('should fetch and return all workspace intelligence metrics and alerts', async () => {
      actionRepo.findPending.mockResolvedValue([{ id: 'action-1', commandType: 'TASK_CREATE', reason: 'Automated' }] as any);

      const result = await service.getDashboard('space-1', userId);

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { userId_spaceId: { userId, spaceId: 'space-1' } },
      });
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('pendingActions');
      expect(result).toHaveProperty('approvals');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('recentDecisions');
      expect(result).toHaveProperty('meetingIntelligence');
    });
  });

  // ─── AIChatSession CRUD ──────────────────────────────────────────

  describe('AIChatSession CRUD', () => {
    const sessionId = 'session-1';
    const mockSession = { id: sessionId, userId, title: 'Session Title', messages: [] };

    describe('listChatSessions()', () => {
      it('should return all chat sessions for user', async () => {
        chatSessionRepo.findByUser.mockResolvedValue([mockSession] as any);
        const result = await service.listChatSessions(userId);
        expect(chatSessionRepo.findByUser).toHaveBeenCalledWith(userId);
        expect(result).toEqual([mockSession]);
      });
    });

    describe('getChatSession()', () => {
      it('should return session if found and user owns it', async () => {
        chatSessionRepo.findById.mockResolvedValue(mockSession as any);
        const result = await service.getChatSession(sessionId, userId);
        expect(chatSessionRepo.findById).toHaveBeenCalledWith(sessionId);
        expect(result).toEqual(mockSession);
      });

      it('should throw NotFoundException if session not found', async () => {
        chatSessionRepo.findById.mockResolvedValue(null);
        await expect(service.getChatSession(sessionId, userId)).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException if user does not own session', async () => {
        chatSessionRepo.findById.mockResolvedValue({ ...mockSession, userId: 'other-user' } as any);
        await expect(service.getChatSession(sessionId, userId)).rejects.toThrow(ForbiddenException);
      });
    });

    describe('createChatSession()', () => {
      it('should create a chat session', async () => {
        const createData = { title: 'New Title', messages: [] };
        chatSessionRepo.create.mockResolvedValue(mockSession as any);
        const result = await service.createChatSession(userId, createData);
        expect(chatSessionRepo.create).toHaveBeenCalledWith(userId, createData);
        expect(result).toEqual(mockSession);
      });
    });

    describe('updateChatSession()', () => {
      it('should update session if ownership is verified', async () => {
        const updateData = { title: 'Updated' };
        chatSessionRepo.findById.mockResolvedValue(mockSession as any);
        chatSessionRepo.update.mockResolvedValue({ ...mockSession, ...updateData } as any);
        const result = await service.updateChatSession(sessionId, userId, updateData);
        expect(chatSessionRepo.update).toHaveBeenCalledWith(sessionId, userId, updateData);
        expect(result.title).toBe('Updated');
      });
    });

    describe('deleteChatSession()', () => {
      it('should delete session if ownership is verified', async () => {
        chatSessionRepo.findById.mockResolvedValue(mockSession as any);
        chatSessionRepo.delete.mockResolvedValue(mockSession as any);
        const result = await service.deleteChatSession(sessionId, userId);
        expect(chatSessionRepo.delete).toHaveBeenCalledWith(sessionId, userId);
        expect(result).toEqual(mockSession);
      });
    });
  });
});
