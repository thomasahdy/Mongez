import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { getAuthCookie } from './helpers/auth-helper';

describe('WorkflowController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let requesterCookies: string[];
  let approverCookies: string[];
  let requester: any;
  let approver: any;
  let space: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await createTestApp(moduleFixture);
    prisma = app.get(PrismaService);
    factories = new TestFactories(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Setup requester and approver
    requester = await factories.createUser({ email: 'requester@mongez.test' });
    approver = await factories.createUser({ email: 'approver@mongez.test' });

    requesterCookies = await getAuthCookie(app, 'requester@mongez.test');
    approverCookies = await getAuthCookie(app, 'approver@mongez.test');

    space = await factories.createSpace({ name: 'Workflow Space' });

    // Establish memberships in the space
    await factories.createMembership(requester.id, space.id, 'MEMBER');
    await factories.createMembership(approver.id, space.id, 'ADMIN');
  });

  describe('Workflow End-to-End lifecycle', () => {
    it('IT-API-WORKFLOW-001: should register a definition, start it, submit decisions, and resolve as APPROVED', async () => {
      // 1. Create a definition
      const defRes = await request(app.getHttpServer())
        .post('/api/v1/workflow/definitions')
        .set('Cookie', approverCookies)
        .send({
          spaceId: space.id,
          name: 'Purchase Approval Flow',
          triggerType: 'MANUAL',
          steps: [
            {
              name: 'Finance Approval',
              approverType: 'USER',
              approverIds: [approver.id],
              isParallel: false,
              requiresAll: true,
            },
          ],
        })
        .expect(201);

      const definitionId = defRes.body.data.id;
      expect(definitionId).toBeDefined();

      // 2. Start a workflow instance
      const startRes = await request(app.getHttpServer())
        .post('/api/v1/workflow/start')
        .set('Cookie', requesterCookies)
        .send({
          definitionId,
          spaceId: space.id,
          entityType: 'task',
          entityId: 'some-task-uuid',
          context: { amount: 1500 },
        })
        .expect(201);

      const instanceId = startRes.body.data.id;
      expect(instanceId).toBeDefined();
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      // 3. View pending reviews as the approver
      const pendingRes = await request(app.getHttpServer())
        .get(`/api/v1/workflow/pending?spaceId=${space.id}`)
        .set('Cookie', approverCookies)
        .expect(200);

      expect(pendingRes.body.data.data.some((i: any) => i.id === instanceId)).toBe(true);

      // 4. Submit an APPROVED decision
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/workflow/instances/${instanceId}/approve`)
        .set('Cookie', approverCookies)
        .send({ note: 'Looks good, approved!' })
        .expect(201);

      expect(approveRes.body.data.status).toBe('APPROVED');

      // Verify notification created for requester
      const notification = await prisma.notification.findFirst({
        where: { userId: requester.id, type: 'WORKFLOW_APPROVED' },
      });
      expect(notification).toBeDefined();
    });

    it('IT-API-WORKFLOW-002: should resolve as REJECTED immediately when step is rejected', async () => {
      // Create definition
      const def = await prisma.workflowDefinition.create({
        data: {
          spaceId: space.id,
          name: 'Simple Flow',
          triggerType: 'MANUAL',
          createdBy: approver.id,
          isActive: true,
        },
      });

      await prisma.workflowStep.create({
        data: {
          definitionId: def.id,
          order: 0,
          name: 'Manager Review',
          approverType: 'USER',
          approverIds: [approver.id],
        },
      });

      // Start instance
      const instance = await prisma.workflowInstance.create({
        data: {
          definitionId: def.id,
          spaceId: space.id,
          entityType: 'task',
          entityId: 'task-1',
          requesterId: requester.id,
          status: 'IN_PROGRESS',
          currentStep: 0,
        },
      });

      // Reject
      const rejectRes = await request(app.getHttpServer())
        .post(`/api/v1/workflow/instances/${instance.id}/reject`)
        .set('Cookie', approverCookies)
        .send({ note: 'Out of budget.' })
        .expect(201);

      expect(rejectRes.body.data.status).toBe('REJECTED');
    });
  });
});
