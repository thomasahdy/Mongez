import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { EventBus } from '@nestjs/cqrs';
import { WorkflowResolvedEvent } from '../src/modules/workflow/events/workflow-events';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../src/infrastructure/queue/queue.constants';
import { Queue } from 'bullmq';
import { WhatsAppService } from '../src/modules/whatsapp/services/whatsapp.service';

describe('Event & Webhook Idempotency (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let eventBus: EventBus;
  let factories: TestFactories;
  let notificationsQueue: Queue;
  let whatsappService: WhatsAppService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    eventBus = app.get(EventBus);
    whatsappService = app.get(WhatsAppService);
    notificationsQueue = app.get<Queue>(getQueueToken(QUEUE_NAMES.NOTIFICATIONS));
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  describe('WorkflowResolvedEvent Idempotency', () => {
    it('should create exactly one DecisionRecord on duplicate WorkflowResolvedEvent', async () => {
      // 1. Setup Space & Workflow Definition
      const space = await factories.createSpace();
      const user = await factories.createUser();
      const definition = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Budget Approval',
          triggerType: 'MANUAL',
          isActive: true,
          createdBy: user.id,
        },
      });

      // 2. Create resolved workflow instance
      const instance = await prisma.workflowInstance.create({
        data: {
          definitionId: definition.id,
          spaceId: space.id,
          entityType: 'BUDGET',
          entityId: 'budget-1',
          requesterId: user.id,
          status: 'APPROVED',
        },
      });

      // 3. Publish duplicate events via NestJS EventBus
      const event = new WorkflowResolvedEvent(instance, 'APPROVED');
      
      // Publish first time
      await eventBus.publish(event);
      // Wait for async handler
      await new Promise((resolve) => setTimeout(resolve, 500));

      const countAfterFirst = await prisma.decisionRecord.count({
        where: { workflowInstanceId: instance.id },
      });
      expect(countAfterFirst).toBe(1);

      // Publish second time
      await eventBus.publish(event);
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 4. Verify no second record was created, and listener handled it gracefully
      const countAfterSecond = await prisma.decisionRecord.count({
        where: { workflowInstanceId: instance.id },
      });
      expect(countAfterSecond).toBe(1);
    });
  });

  describe('BullMQ Job Idempotency / Deduplication', () => {
    it('should deduplicate queue jobs when enqueued with same jobId', async () => {
      const jobId = `test-job-dedup-${Date.now()}`;
      const payload = { data: 'test-event-relay' };

      // Add first job
      const job1 = await notificationsQueue.add('process_event', payload, {
        jobId,
        removeOnComplete: false,
      });

      // Add duplicate job
      const job2 = await notificationsQueue.add('process_event', payload, {
        jobId,
        removeOnComplete: false,
      });

      // BullMQ uses native deduplication: if jobId exists, the second add returns the existing job
      expect(job1.id).toBe(jobId);
      expect(job2.id).toBe(jobId);

      // Clean up the job safely
      try {
        await job1.remove();
      } catch (e) {}
    });
  });

  describe('WhatsApp Webhook Idempotency', () => {
    it('should return 200 and ignore duplicate waMessageId in inbound webhook', async () => {
      // 1. Setup space, whatsapp account, verified contact
      const space = await factories.createSpace();
      const user = await factories.createUser();
      await factories.createMembership(user.id, space.id);

      const phoneNumberId = '1234567890';
      const wabaId = 'waba-999';
      await prisma.whatsAppAccount.create({
        data: {
          spaceId: space.id,
          phoneNumberId,
          wabaId,
          accessToken: 'encrypted-token',
          displayName: 'Test Business Profile',
          isActive: true,
          webhookSecret: 'secret-key',
        },
      });

      const contactPhone = '+15555550199';
      const contact = await prisma.whatsAppContact.create({
        data: {
          userId: user.id,
          spaceId: space.id,
          phoneNumber: contactPhone,
          waId: 'wa-id-123',
          isVerified: true,
        },
      });

      // 2. Mock signature verification bypass or generate a real signature
      // Since it uses crypto.createHmac('sha256', secret), let's mock it
      jest.spyOn(whatsappService, 'verifyWebhookSignature').mockReturnValue(true);

      const webhookBody = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: wabaId,
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '16505551111',
                    phone_number_id: phoneNumberId,
                  },
                  contacts: [{ profile: { name: 'User' }, wa_id: 'wa-id-123' }],
                  messages: [
                    {
                      from: '15555550199',
                      id: 'wamid.HBgLMTU1NTU1NTAxOTkVAgASGBQzQjE2QzY0OTI2NzlDN0FBRjhDQQA=',
                      timestamp: '1623887220',
                      text: { body: 'Hello mongez bot' },
                      type: 'text',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      // 3. Post first time
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/whatsapp/webhook')
        .set('x-hub-signature-256', 'sha256=mock-signature')
        .send(webhookBody)
        .expect(200);

      expect(res1.body.data.status).toBe('ok');

      // Wait a moment for background processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const msgCount1 = await prisma.whatsAppMessage.count({
        where: { waMessageId: 'wamid.HBgLMTU1NTU1NTAxOTkVAgASGBQzQjE2QzY0OTI2NzlDN0FBRjhDQQA=' },
      });
      expect(msgCount1).toBe(1);

      // 4. Post duplicate webhook (same message ID)
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/whatsapp/webhook')
        .set('x-hub-signature-256', 'sha256=mock-signature')
        .send(webhookBody)
        .expect(200); // Expect 200 (never crash or reject the webhook call directly)

      expect(res2.body.data.status).toBe('ok');

      await new Promise((resolve) => setTimeout(resolve, 500));

      // 5. Verify no duplicate message was inserted in the database
      const msgCount2 = await prisma.whatsAppMessage.count({
        where: { waMessageId: 'wamid.HBgLMTU1NTU1NTAxOTkVAgASGBQzQjE2QzY0OTI2NzlDN0FBRjhDQQA=' },
      });
      expect(msgCount2).toBe(1);
    });
  });
});
