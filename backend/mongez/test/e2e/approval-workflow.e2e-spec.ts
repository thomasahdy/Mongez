import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { cleanDatabase } from '../helpers/db-cleaner';
import { createTestApp } from '../helpers/create-test-app';
import { TestFactories, MOCK_PASSWORD } from '../helpers/factories';

describe('Approval Workflow E2E Journey', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;

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
  });

  it('should run happy path approval workflow, generate decision records, and handle delegation', async () => {
    // 1. Seed users, space, memberships
    const space = await factories.createSpace();
    const owner = await factories.createUser({ email: 'owner@mongez.test', name: 'Owner' });
    const reviewer = await factories.createUser({ email: 'reviewer@mongez.test', name: 'Reviewer' });
    const delegate = await factories.createUser({ email: 'delegate@mongez.test', name: 'Delegate' });

    await factories.createMembership(owner.id, space.id, 'OWNER');
    await factories.createMembership(reviewer.id, space.id, 'ADMIN');
    await factories.createMembership(delegate.id, space.id, 'MEMBER');

    // 2. Get login tokens
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: MOCK_PASSWORD })
        .expect(200);
      return res.body.data.accessToken as string;
    };

    const ownerToken = await login(owner.email);
    const reviewerToken = await login(reviewer.email);
    const delegateToken = await login(delegate.email);

    // 3. Create Workflow Definition
    const definitionPayload = {
      spaceId: space.id,
      name: 'Budget Approval Flow',
      triggerType: 'MANUAL',
      steps: [
        {
          name: 'Manager Review',
          approverType: 'USER',
          approverIds: [reviewer.id],
        },
      ],
    };

    const defRes = await request(app.getHttpServer())
      .post('/api/v1/workflow/definitions')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(definitionPayload)
      .expect(201);

    expect(defRes.body.success).toBe(true);
    const definition = defRes.body.data;
    expect(definition.name).toBe(definitionPayload.name);

    // 4. Start Workflow Instance
    const startPayload = {
      definitionId: definition.id,
      spaceId: space.id,
      entityType: 'BUDGET',
      entityId: 'budget-101',
      context: { amount: 5000 },
    };

    const startRes = await request(app.getHttpServer())
      .post('/api/v1/workflow/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(startPayload)
      .expect(201);

    expect(startRes.body.success).toBe(true);
    const instance = startRes.body.data;
    expect(instance.status).toBe('IN_PROGRESS');

    // 5. Unauthorized User (delegate) attempts to approve -> expect 403 or 400
    await request(app.getHttpServer())
      .post(`/api/v1/workflow/instances/${instance.id}/approve`)
      .set('Authorization', `Bearer ${delegateToken}`)
      .send({ note: 'Looks good' })
      .expect((res) => {
        // If not matching reviewer, it should throw ForbiddenException
        expect(res.status === 403 || res.status === 400).toBe(true);
      });

    // 6. Reviewer approves -> expect success 201
    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/workflow/instances/${instance.id}/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ note: 'Budget approved' })
      .expect(201);

    expect(approveRes.body.success).toBe(true);
    
    // 7. Verify DecisionRecord is created
    const decision = await prisma.decisionRecord.findFirst({
      where: { workflowInstanceId: instance.id },
    });
    expect(decision).toBeDefined();
    expect(decision!.outcome).toBe('APPROVED');
    expect(decision!.decidedById).toBe(reviewer.id);

    // 8. Start a second workflow instance to test delegation
    const secondStartRes = await request(app.getHttpServer())
      .post('/api/v1/workflow/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...startPayload, entityId: 'budget-102' })
      .expect(201);

    const secondInstance = secondStartRes.body.data;

    // 9. Delegate reviewer's authority to delegate user
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const delegationRes = await request(app.getHttpServer())
      .post('/api/v1/delegations')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        spaceId: space.id,
        delegateId: delegate.id,
        startDate: now.toISOString(),
        endDate: tomorrow.toISOString(),
      })
      .expect(201);

    expect(delegationRes.body.success).toBe(true);
    const delegation = delegationRes.body.data;

    // 10. Delegate approves the second workflow instance -> expect success due to active delegation
    const delegateApproveRes = await request(app.getHttpServer())
      .post(`/api/v1/workflow/instances/${secondInstance.id}/approve`)
      .set('Authorization', `Bearer ${delegateToken}`)
      .send({ note: 'Approved as delegate' })
      .expect(201);

    expect(delegateApproveRes.body.success).toBe(true);

    // 11. Deactivate delegation
    await request(app.getHttpServer())
      .patch(`/api/v1/delegations/${delegation.id}/deactivate`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    // 12. Start third instance to verify delegation revocation
    const thirdStartRes = await request(app.getHttpServer())
      .post('/api/v1/workflow/start')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...startPayload, entityId: 'budget-103' })
      .expect(201);

    const thirdInstance = thirdStartRes.body.data;

    // 13. Delegate attempts to approve again -> expect failure because delegation is inactive
    await request(app.getHttpServer())
      .post(`/api/v1/workflow/instances/${thirdInstance.id}/approve`)
      .set('Authorization', `Bearer ${delegateToken}`)
      .send({ note: 'Approve again' })
      .expect((res) => {
        expect(res.status === 403 || res.status === 400).toBe(true);
      });
  });
});
