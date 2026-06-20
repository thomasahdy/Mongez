import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { cleanDatabase } from '../helpers/db-cleaner';
import { createTestApp } from '../helpers/create-test-app';
import { TestFactories, MOCK_PASSWORD } from '../helpers/factories';

describe('File Upload & Search E2E Journey', () => {
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

  it('should upload a file, search for it, download it, verify cross-tenant security and delete it', async () => {
    // 1. Setup space1, user1 (OWNER) and task1
    const space1 = await factories.createSpace({ name: 'Space 1', prefix: 'ONE' });
    const user1 = await factories.createUser({ email: 'user1@mongez.test', name: 'User 1' });
    await factories.createMembership(user1.id, space1.id, 'OWNER');
    const dept1 = await factories.createDepartment(space1.id);
    const board1 = await factories.createBoard(dept1.id);
    const col1 = await factories.createBoardColumn(board1.id);
    const task1 = await factories.createTask(board1.id, user1.id, { columnId: col1.id });

    // 2. Setup space2, user2 (OWNER)
    const space2 = await factories.createSpace({ name: 'Space 2', prefix: 'TWO' });
    const user2 = await factories.createUser({ email: 'user2@mongez.test', name: 'User 2' });
    await factories.createMembership(user2.id, space2.id, 'OWNER');

    // 3. Login both users
    const login = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: MOCK_PASSWORD })
        .expect(200);
      return res.body.data.accessToken as string;
    };

    const token1 = await login(user1.email);
    const token2 = await login(user2.email);

    // 4. Upload clean file as user1
    const cleanBuffer = Buffer.from('Mongez Clean File Content');
    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${task1.id}/files`)
      .set('Authorization', `Bearer ${token1}`)
      .attach('file', cleanBuffer, 'clean-document.txt')
      .expect(201);

    expect(uploadRes.body.success).toBe(true);
    const file = uploadRes.body.data;
    expect(file.fileName).toBe('clean-document.txt');
    expect(file.id).toBeDefined();

    // 5. Search for the file in space1
    const searchRes = await request(app.getHttpServer())
      .get(`/api/v1/search?q=clean-document.txt&spaceId=${space1.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(searchRes.body.success).toBe(true);
    const searchData = searchRes.body.data;
    expect(searchData.files.some((f: any) => f.id === file.id)).toBe(true);

    // 6. Download file (should redirect to S3/local storage signed URL)
    const downloadRes = await request(app.getHttpServer())
      .get(`/api/v1/files/${file.id}/download`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(302);

    expect(downloadRes.headers.location).toBeDefined();

    // 7. Security: Cross-tenant download attempt by user2 -> expect 403 or 400
    await request(app.getHttpServer())
      .get(`/api/v1/files/${file.id}/download`)
      .set('Authorization', `Bearer ${token2}`)
      .expect((res) => {
        expect(res.status === 403 || res.status === 400).toBe(true);
      });

    // 8. Security: Cross-tenant task files listing by user2 -> expect 403
    await request(app.getHttpServer())
      .get(`/api/v1/tasks/${task1.id}/files`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    // 9. Error Check: Upload virus infected file (EICAR signature)
    const eicarSignature = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
    const infectedBuffer = Buffer.from(eicarSignature);
    const virusRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${task1.id}/files`)
      .set('Authorization', `Bearer ${token1}`)
      .attach('file', infectedBuffer, 'malware.txt')
      .expect(400);

    expect(virusRes.body.error.message).toContain('Virus detected');

    // 10. Error Check: Upload oversized file (> 25MB)
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB
    const oversizedRes = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${task1.id}/files`)
      .set('Authorization', `Bearer ${token1}`)
      .attach('file', largeBuffer, 'huge.zip')
      .expect(400);

    expect(oversizedRes.body.error.message).toContain('exceeds maximum size');

    // 11. Delete own file
    await request(app.getHttpServer())
      .delete(`/api/v1/files/${file.id}`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(204);

    // 12. Verify file is deleted
    const deletedFile = await prisma.attachment.findUnique({
      where: { id: file.id },
    });
    // The attachment repository softDeletes the file, meaning it still exists in DB but with a non-null deletedAt
    // Let's verify how fileRepo soft deletes.
    // If it is in DB, let's verify if listForTask filters it out.
    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/tasks/${task1.id}/files`)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    expect(listRes.body.success).toBe(true);
    const files = listRes.body.data.data;
    expect(files.some((f: any) => f.id === file.id)).toBe(false);
  });
});
