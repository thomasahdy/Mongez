import { Test, TestingModule } from '@nestjs/testing';
import { AIMemoryService } from './ai-memory.service';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

describe('AIMemoryService', () => {
  let service: AIMemoryService;
  let cacheService: CacheService;
  let prismaService: PrismaService;

  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    getOrSet: jest.fn((key, factory) => factory()),
  };

  const mockPrisma = {
    aiConversationTurn: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
    workflowInstance: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIMemoryService,
        { provide: CacheService, useValue: mockCache },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AIMemoryService>(AIMemoryService);
    cacheService = module.get<CacheService>(CacheService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve conversation turns from Redis session', async () => {
    mockCache.get.mockResolvedValue([{ role: 'user', content: 'hello' }]);

    const session = await service.getSession('user-1', 'space-1');

    expect(session).toEqual([{ role: 'user', content: 'hello' }]);
    expect(cacheService.get).toHaveBeenCalledWith('ai:session:user-1:space-1');
  });

  it('should append turns to session, keeping at most 20 turns', async () => {
    const existingSession = Array.from({ length: 20 }, (_, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: `msg ${idx}`,
    }));
    mockCache.get.mockResolvedValue(existingSession);

    await service.appendToSession('user-1', 'space-1', {
      role: 'user',
      content: 'latest msg',
    });

    expect(cacheService.set).toHaveBeenCalledWith(
      'ai:session:user-1:space-1',
      expect.any(Array),
      1800,
    );

    const savedArg = mockCache.set.mock.calls[0][1];
    expect(savedArg.length).toBe(20);
    expect(savedArg[19]).toEqual({ role: 'user', content: 'latest msg' });
  });

  it('should save conversation turn to Postgres', async () => {
    mockPrisma.aiConversationTurn.create.mockResolvedValue({ id: 'turn-1' });

    await service.saveConversationTurn('user-1', 'space-1', 'user', 'hi', 'trace-1');

    expect(prismaService.aiConversationTurn.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        spaceId: 'space-1',
        role: 'user',
        content: 'hi',
        traceId: 'trace-1',
      },
    });
  });

  it('should compile context with session history and workspace stats', async () => {
    mockCache.get.mockResolvedValue([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ]);
    mockPrisma.task.count.mockResolvedValue(5);
    mockPrisma.workflowInstance.count.mockResolvedValue(2);

    const context = await service.getConversationContext('user-1', 'space-1');

    expect(context).toContain('5 tasks created');
    expect(context).toContain('2 pending approvals');
    expect(context).toContain('User: hello');
    expect(context).toContain('Assistant: hi there');
  });
});
