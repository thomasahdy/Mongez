import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/db-cleaner';

async function runLoadSimulation() {
  console.log('--- ENTERPRISE LOAD SIMULATION ---');
  
  // 1. Boot Nest App
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = await createTestApp(moduleFixture);
  const prisma = app.get(PrismaService);
  
  console.log('Cleaning database...');
  await cleanDatabase(prisma);
  
  // 2. Setup options from environment
  const isFullRun = process.env.LOAD_TEST_FULL === 'true';
  const durationMs = isFullRun ? 30 * 60 * 1000 : 5000; // 30 mins or 5 seconds
  const vuCount = isFullRun ? 100 : 5; // 100 VUs or 5 VUs
  
  console.log(`Running simulation with ${vuCount} VUs for ${durationMs / 1000}s...`);

  // 3. Register user and get token for each VU
  const tokens: string[] = [];
  const spaceIds: string[] = [];
  const spacePrefixes: string[] = [];
  const boardIds: string[] = [];
  const columnIds: string[] = [];
  
  console.log('Creating test user environments...');
  for (let i = 0; i < vuCount; i++) {
    const email = `load-user-${i}-${Date.now()}@mongez.test`;
    
    // Register
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123!', name: `Load User ${i}` });
    
    const token = regRes.body?.data?.accessToken;
    if (!token) {
      throw new Error(`Failed to register user ${email}: ${JSON.stringify(regRes.body)}`);
    }
    tokens.push(token);

    // Create Space with pure uppercase letters prefix
    const char1 = String.fromCharCode(65 + (i % 26));
    const char2 = String.fromCharCode(65 + ((i + 1) % 26));
    const prefix = `${char1}${char2}`;
    spacePrefixes.push(prefix);

    const spaceRes = await request(app.getHttpServer())
      .post('/api/v1/spaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Space ${i}`, prefix, description: 'Load testing space' });
    
    const spaceId = spaceRes.body?.data?.id;
    if (!spaceId) {
      throw new Error(`Failed to create space for user ${i}: ${spaceRes.status} ${JSON.stringify(spaceRes.body)}`);
    }
    spaceIds.push(spaceId);

    // Get templates
    const templatesRes = await request(app.getHttpServer())
      .get('/api/v1/onboarding/templates')
      .set('Authorization', `Bearer ${token}`);
    
    const templateId = templatesRes.body?.data?.[0]?.id;
    
    // Setup space onboarding to get board/column
    const onboardingRes = await request(app.getHttpServer())
      .post('/api/v1/onboarding/setup')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: `Space Board ${i}`,
        description: 'Board for load testing',
        icon: '💼',
        color: '#ff9900',
        prefix: `${char2}${char1}`,
        templateId,
      });

    const spaceData = onboardingRes.body?.data;
    const boardId = spaceData?.departments?.[0]?.boards?.[0]?.id;
    const columnId = spaceData?.departments?.[0]?.boards?.[0]?.columns?.[0]?.id;
    
    boardIds.push(boardId);
    columnIds.push(columnId);
  }

  // 4. Measure initial state
  const initialMemory = process.memoryUsage().heapUsed;
  const startTime = Date.now();
  let totalRequests = 0;
  let failedRequests = 0;
  let deadlocksDetected = 0;

  console.log('Simulating concurrent user activity...');
  
  // 5. Start VU loops
  const vuPromises = tokens.map(async (token, vuIndex) => {
    const spaceId = spaceIds[vuIndex];
    const boardId = boardIds[vuIndex];
    const columnId = columnIds[vuIndex];
    const spacePrefix = spacePrefixes[vuIndex];
    
    while (Date.now() - startTime < durationMs) {
      try {
        // Task lifecycle load
        // A. Create Task
        const createRes = await request(app.getHttpServer())
          .post('/api/v1/tasks')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Task Load VU ${vuIndex} - ${Date.now()}`,
            description: 'Task under load simulation',
            boardId,
            columnId,
            spaceId,
            spacePrefix,
          });
        
        totalRequests++;
        if (createRes.status !== 201) failedRequests++;
        
        const taskId = createRes.body?.data?.id;
        
        if (taskId) {
          // B. Get Board Tasks
          const getRes = await request(app.getHttpServer())
            .get(`/api/v1/boards/${boardId}/tasks`)
            .set('Authorization', `Bearer ${token}`);
          
          totalRequests++;
          if (getRes.status !== 200) failedRequests++;

          // C. Update Task
          const updateRes = await request(app.getHttpServer())
            .patch(`/api/v1/tasks/${taskId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: `Task Load VU ${vuIndex} - Updated` });
          
          totalRequests++;
          if (updateRes.status !== 200) failedRequests++;

          // D. Delete Task
          const deleteRes = await request(app.getHttpServer())
            .delete(`/api/v1/tasks/${taskId}`)
            .set('Authorization', `Bearer ${token}`);
          
          totalRequests++;
          if (deleteRes.status !== 204) failedRequests++;
        }
      } catch (err: any) {
        if (err.message?.includes('deadlock') || err.message?.includes('40713')) {
          deadlocksDetected++;
        }
        failedRequests++;
      }
      
      // Sleep a small duration to simulate realistic pacing
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  });

  await Promise.all(vuPromises);

  // 6. Measure final state
  const finalMemory = process.memoryUsage().heapUsed;
  const durationSec = (Date.now() - startTime) / 1000;
  const memoryGrowth = finalMemory - initialMemory;

  console.log('--- SIMULATION REPORT ---');
  console.log(`Duration: ${durationSec.toFixed(2)}s`);
  console.log(`Total API Requests Executed: ${totalRequests}`);
  console.log(`Failed API Requests: ${failedRequests}`);
  console.log(`Deadlocks Detected: ${deadlocksDetected}`);
  console.log(`Initial Heap Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Final Heap Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

  // Assertions
  if (failedRequests > totalRequests * 0.05) {
    console.error(`FAIL: High request failure rate (${(failedRequests / totalRequests * 100).toFixed(2)}%)`);
    process.exit(1);
  }
  
  if (deadlocksDetected > 0) {
    console.error(`FAIL: DB deadlocks detected: ${deadlocksDetected}`);
    process.exit(1);
  }
  
  if (isFullRun && memoryGrowth > 150 * 1024 * 1024) {
    console.error('FAIL: Potential memory leak detected. Memory grew by more than 150MB.');
    process.exit(1);
  }

  console.log('SUCCESS: Enterprise load simulation completed within parameters.');
  await app.close();
  process.exit(0);
}

runLoadSimulation().catch((err) => {
  console.error('Simulation crashed:', err);
  process.exit(1);
});
