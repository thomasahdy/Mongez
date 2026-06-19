import request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function getAuthCookie(app: INestApplication, email: string): Promise<string[]> {
  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password: 'Password123' })
    .expect(200);

  const cookies = loginRes.headers['set-cookie'];
  return Array.isArray(cookies) ? cookies : typeof cookies === 'string' ? [cookies] : [];
}
