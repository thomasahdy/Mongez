import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { OutboxRelayService } from '../../src/modules/notifications/outbox/outbox-relay.service';
import { WebSocketChannel } from '../../src/modules/notifications/channels/websocket.channel';
import { PresenceService } from '../../src/modules/notifications/presence/presence.service';
import { TestFactories } from '../helpers/factories';
import { cleanDatabase } from '../helpers/db-cleaner';
import { getAuthCookie } from '../helpers/auth-helper';
import { createTestApp } from '../helpers/create-test-app';
import { TaskStatus, Priority } from '@prisma/client';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueEvents } from 'bullmq';
import { QUEUE_NAMES } from '../../src/infrastructure/queue/queue.constants';

describe('Notification E2E Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let outboxRelay: OutboxRelayService;
  let presenceService: PresenceService;
  let queueEvents: QueueEvents;
  let mockWebSocketChannel: any;

  let testUser: any;
  let authCookie: string[];
  let space: any;
  let board: any;
  let column: any;

  beforeAll(async () => {
    mockWebSocketChannel = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(WebSocketChannel)
      .useValue(mockWebSocketChannel)
      .compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    factories = new TestFactories(prisma);
    outboxRelay = app.get(OutboxRelayService);
    presenceService = app.get(PresenceService);

    queueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATIONS, {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6381,
      },
    });
    await queueEvents.waitUntilReady();
  });

  afterAll(async () => {
    await queueEvents.close();
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    const redis = (presenceService as any).cacheService.redis;
    const keysToDel = [
      ...(await redis.keys('idempotency:*')),
      ...(await redis.keys('user:*')),
      ...(await redis.keys('digest_*')),
    ];
    if (keysToDel.length > 0) {
      await redis.del(...keysToDel);
    }
    jest.clearAllMocks();

    // Setup basic workspace hierarchy for testing tasks
    testUser = await factories.createUser({ email: 'notification-user@mongez.test' });
    authCookie = await getAuthCookie(app, 'notification-user@mongez.test');

    space = await factories.createSpace({ prefix: 'NOT' });
    await factories.createMembership(testUser.id, space.id, 'ADMIN');

    const department = await factories.createDepartment(space.id);
    board = await factories.createBoard(department.id);
    column = await factories.createBoardColumn(board.id);

    // Make user online so they get websocket notifications immediately
    await presenceService.recordHeartbeat(testUser.id);
  });

  it('should process the entire chain: Task -> Outbox -> Relay -> Queue -> DB Notification -> WS Broadcast', async () => {
    const taskData = {
      title: 'Chain Reaction Task',
      boardId: board.id,
      columnId: column.id,
      spaceId: space.id,
      spacePrefix: space.prefix,
      status: TaskStatus.TODO,
      priority: Priority.HIGH,
      assigneeIds: [testUser.id], // Assign the user so they get notified
    };

    // 1. Create Task via API
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/tasks')
      .set('Cookie', authCookie)
      .send(taskData)
      .expect(201);

    const taskId = createRes.body.data.id;
    expect(taskId).toBeDefined();

    // 2. Assert Outbox Record Created
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { aggregateId: taskId },
    });
    expect(outboxEvents.length).toBeGreaterThanOrEqual(1);

    const createEvent = outboxEvents.find((e) => e.eventType === 'task.created');
    const assignEvent = outboxEvents.find((e) => e.eventType === 'task.assigned');
    expect(createEvent).toBeDefined();
    expect(assignEvent).toBeDefined();

    // 3. Trigger Outbox Relay manually
    await outboxRelay.handleOutboxRelay();

    // Verify outbox records are marked processed in DB
    const processedCreateEvent = await prisma.outboxEvent.findUnique({
      where: { id: createEvent!.id },
    });
    const processedAssignEvent = await prisma.outboxEvent.findUnique({
      where: { id: assignEvent!.id },
    });
    expect(processedCreateEvent?.processedAt).not.toBeNull();
    expect(processedAssignEvent?.processedAt).not.toBeNull();

    // 4. Wait for BullMQ Job execution for both events
    const notificationsQueue = app.get(getQueueToken(QUEUE_NAMES.NOTIFICATIONS));
    const jobCreate = await notificationsQueue.getJob(createEvent!.id);
    const jobAssign = await notificationsQueue.getJob(assignEvent!.id);
    expect(jobCreate).toBeDefined();
    expect(jobAssign).toBeDefined();

    await jobCreate!.waitUntilFinished(queueEvents, 10000);
    await jobAssign!.waitUntilFinished(queueEvents, 10000);

    // 5. Assert Notifications Saved in DB
    const savedNotifications = await prisma.notification.findMany({
      where: { userId: testUser.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(savedNotifications.length).toBe(2);
    expect(savedNotifications[0].type).toBe('task.created');
    expect(savedNotifications[0].channel).toBe('IN_APP');
    expect(savedNotifications[1].type).toBe('task.assigned');
    expect(savedNotifications[1].channel).toBe('IN_APP');

    // 6. Assert WebSocket Sent
    expect(mockWebSocketChannel.send).toHaveBeenCalledTimes(2);
    expect(mockWebSocketChannel.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: savedNotifications[0].id,
        userId: testUser.id,
        type: 'task.created',
      }),
      expect.any(Object)
    );
    expect(mockWebSocketChannel.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: savedNotifications[1].id,
        userId: testUser.id,
        type: 'task.assigned',
      }),
      expect.any(Object)
    );
  });
});
