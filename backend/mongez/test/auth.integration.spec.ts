import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { TestFactories } from './helpers/factories';
import { cleanDatabase } from './helpers/db-cleaner';
import { createTestApp } from './helpers/create-test-app';

describe('AuthController (Integration)', () => {
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

  describe('POST /api/v1/auth/register', () => {
    it('IT-API-AUTH-001: should register a user successfully and set cookies', async () => {
      const email = 'register@mongez.test';
      const password = 'Password123';
      const name = 'New User';

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password, name })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(email);

      // Verify cookies are set
      const rawCookies = res.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === 'string' ? [rawCookies] : [];
      expect(cookies.some((c: string) => c.includes('access_token'))).toBe(true);
      expect(cookies.some((c: string) => c.includes('refresh_token'))).toBe(true);

      // Verify db insertion
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeDefined();
      expect(user?.name).toBe(name);
    });

    it('IT-API-AUTH-002: should return 409 Conflict if email already exists', async () => {
      const email = 'duplicate@mongez.test';
      await factories.createUser({ email });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'Password123', name: 'Another Name' })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('IT-API-AUTH-005: should login successfully with correct credentials', async () => {
      const email = 'login@mongez.test';
      await factories.createUser({ email }); // default password is 'Password123'

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(email);
    });

    it('IT-API-AUTH-006: should return 401 Unauthorized for wrong password', async () => {
      const email = 'wrong-pwd@mongez.test';
      await factories.createUser({ email });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword' })
        .expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('credentials');
    });

    it('IT-API-AUTH-009: should lock account after 5 failed login attempts', async () => {
      const email = 'lockout@mongez.test';
      await factories.createUser({ email });

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email, password: 'WrongPassword' })
          .expect(401);
      }

      // 6th attempt should return 403 Forbidden due to locked account
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123' })
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('locked');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('IT-API-ME-001: should return user profile if access token cookie is valid', async () => {
      const email = 'me@mongez.test';
      await factories.createUser({ email });

      // First log in to get access token cookie
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'Password123' });

      const cookies = loginRes.headers['set-cookie'];

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(email);
    });

    it('should return 401 if unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });
});
