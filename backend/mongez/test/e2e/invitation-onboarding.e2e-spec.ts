import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { cleanDatabase } from '../helpers/db-cleaner';
import { createTestApp } from '../helpers/create-test-app';
import { TestFactories, MOCK_PASSWORD } from '../helpers/factories';

describe('Invitation & Onboarding E2E Journey', () => {
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

  it('should successfully invite a member, accept, and verify roles and boundaries', async () => {
    // 1. Setup owner, invitee, and third user
    const owner = await factories.createUser({ email: 'owner@mongez.test', name: 'Owner' });
    const invitee = await factories.createUser({ email: 'invitee@mongez.test', name: 'Invitee' });
    const rogue = await factories.createUser({ email: 'rogue@mongez.test', name: 'Rogue User' });

    // 2. Login users
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: MOCK_PASSWORD })
        .expect(200);
      return res.body.data.accessToken as string;
    };

    const ownerToken = await login(owner.email);
    const inviteeToken = await login(invitee.email);
    const rogueToken = await login(rogue.email);

    // 3. Owner creates a space
    const spacePayload = {
      name: 'Owner Workspace',
      description: 'E2E test space',
      prefix: 'OWN',
    };

    const spaceRes = await request(app.getHttpServer())
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(spacePayload)
      .expect(201);

    expect(spaceRes.body.success).toBe(true);
    const space = spaceRes.body.data;

    // 4. Owner invites invitee
    const invitePayload = {
      email: invitee.email,
      role: 'MEMBER',
    };

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/spaces/${space.id}/invitations`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(invitePayload)
      .expect(201);

    expect(inviteRes.body.success).toBe(true);

    // 5. Get invitation token from DB
    const invitation = await prisma.invitation.findFirst({
      where: { email: invitee.email, spaceId: space.id },
    });
    expect(invitation).toBeDefined();
    expect(invitation!.accepted).toBe(false);

    // 6. Rogue user attempts to accept invite -> expect 403 Forbidden
    await request(app.getHttpServer())
      .get(`/api/v1/invitations/accept?token=${invitation!.token}`)
      .set('Authorization', `Bearer ${rogueToken}`)
      .expect(403);

    // 7. Invitee accepts invitation -> expect 200
    const acceptRes = await request(app.getHttpServer())
      .get(`/api/v1/invitations/accept?token=${invitation!.token}`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(200);

    expect(acceptRes.body.success).toBe(true);

    // 8. Verify invitee is member
    const listMembersRes = await request(app.getHttpServer())
      .get(`/api/v1/spaces/${space.id}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(listMembersRes.body.success).toBe(true);
    const members = listMembersRes.body.data;
    expect(members.some((m: any) => m.user.id === invitee.id)).toBe(true);

    // 9. Invitee (MEMBER) attempts to invite someone -> expect 403 Forbidden
    await request(app.getHttpServer())
      .post(`/api/v1/spaces/${space.id}/invitations`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .send({ email: 'newbie@mongez.test', role: 'MEMBER' })
      .expect(403);

    // 10. Invitee (MEMBER) attempts to remove owner -> expect 403 Forbidden
    await request(app.getHttpServer())
      .delete(`/api/v1/spaces/${space.id}/members/${owner.id}`)
      .set('Authorization', `Bearer ${inviteeToken}`)
      .expect(403);

    // 11. Owner removes invitee -> expect 204
    await request(app.getHttpServer())
      .delete(`/api/v1/spaces/${space.id}/members/${invitee.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
  });

  it('should return 404 for invalid invitation token', async () => {
    const user = await factories.createUser();
    const token = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: MOCK_PASSWORD })
      .expect(200)
      .then((res) => res.body.data.accessToken);

    await request(app.getHttpServer())
      .get('/api/v1/invitations/accept?token=invalid-token-123')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
