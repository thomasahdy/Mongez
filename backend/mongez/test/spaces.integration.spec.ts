import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';
import { getAuthCookie } from './helpers/auth-helper';

describe('SpacesController (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let factories: TestFactories;
  let authCookies: string[];
  let user: any;

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

    // Create user and obtain auth cookies
    user = await factories.createUser({ email: 'space-test@mongez.test' });
    authCookies = await getAuthCookie(app, 'space-test@mongez.test');
  });

  describe('POST /api/v1/spaces', () => {
    it('IT-API-SPACE-001: should create a new space and set owner membership', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/spaces')
        .set('Cookie', authCookies)
        .send({ name: 'Integration Testing Space', prefix: 'INT' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Integration Testing Space');
      expect(res.body.data.prefix).toBe('INT');

      // Verify DB membership was created for user as OWNER
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, spaceId: res.body.data.id },
        include: { role: true },
      });
      expect(membership).toBeDefined();
      expect(membership?.role.name).toBe('OWNER');
    });
  });

  describe('GET /api/v1/spaces', () => {
    it('IT-API-SPACE-002: should list all spaces user belongs to', async () => {
      const space = await factories.createSpace({ name: 'Assigned Space' });
      await factories.createMembership(user.id, space.id, 'MEMBER');

      const res = await request(app.getHttpServer())
        .get('/api/v1/spaces')
        .set('Cookie', authCookies)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.data.some((s: any) => s.id === space.id)).toBe(true);
    });
  });

  describe('GET /api/v1/spaces/:id', () => {
    it('IT-API-SPACE-003: should fetch space details for space member', async () => {
      const space = await factories.createSpace({ name: 'Specific Space' });
      await factories.createMembership(user.id, space.id, 'MEMBER');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/spaces/${space.id}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(space.id);
    });

    it('should block non-members from fetching details', async () => {
      const space = await factories.createSpace({ name: 'Hidden Space' });

      await request(app.getHttpServer())
        .get(`/api/v1/spaces/${space.id}`)
        .set('Cookie', authCookies)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/spaces/:id', () => {
    it('IT-API-SPACE-004: should allow owner to update space name', async () => {
      const space = await factories.createSpace({ name: 'Initial Space Name' });
      await factories.createMembership(user.id, space.id, 'OWNER');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/spaces/${space.id}`)
        .set('Cookie', authCookies)
        .send({ name: 'Updated Space Name' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Space Name');
    });
  });

  describe('DELETE /api/v1/spaces/:id', () => {
    it('IT-API-SPACE-005: should allow owner to delete space', async () => {
      const space = await factories.createSpace();
      await factories.createMembership(user.id, space.id, 'OWNER');

      await request(app.getHttpServer())
        .delete(`/api/v1/spaces/${space.id}`)
        .set('Cookie', authCookies)
        .expect(204);

      const deletedSpace = await prisma.space.findUnique({ where: { id: space.id } });
      expect(deletedSpace).toBeNull();
    });
  });
});
