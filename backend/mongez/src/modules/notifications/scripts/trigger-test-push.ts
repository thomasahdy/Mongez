import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  console.log('🚀 Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const notificationsService = app.get(NotificationsService);
  const prisma = app.get(PrismaService);

  // Target email: thomas@mongez.io (active session in browser)
  const targetEmail = 'thomas@mongez.io';

  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: targetEmail,
        mode: 'insensitive'
      }
    },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    console.error(`❌ ERROR: Could not find user with email ${targetEmail}`);
    await app.close();
    process.exit(1);
  }

  console.log(`Found target user: ${user.name} (${user.email}) - ID: ${user.id}`);

  // Target space: space_beta_001 (Beta Platform)
  const spaceId = 'space_beta_001';
  const space = await prisma.space.findUnique({ where: { id: spaceId } });
  console.log(`Found space: ${space?.name} (ID: ${spaceId})`);

  if (!space) {
    console.error(`❌ ERROR: Space ${spaceId} not found.`);
    await app.close();
    process.exit(1);
  }

  // Find a board in this space to create the task
  const board = await prisma.board.findFirst({
    where: {
      department: {
        spaceId: spaceId
      }
    }
  });

  if (!board) {
    console.error('❌ ERROR: No boards found in the space. Run database seed first!');
    await app.close();
    process.exit(1);
  }

  // Create a brand new unique Task
  const identifier = `BET-${Math.floor(1000 + Math.random() * 9000)}`;
  const task = await prisma.task.create({
    data: {
      identifier: identifier,
      title: `⚡ Live Verification Task (${identifier})`,
      description: 'End-to-end task created to verify realtime notification pushes and route navigation.',
      boardId: board.id,
      createdById: user.id,
    }
  });

  console.log(`Created new task: "${task.title}" (ID: ${task.id})`);

  console.log(`Sending notification to ${user.name}...`);
  await notificationsService.queueNotification({
    userId: user.id,
    spaceId: spaceId,
    type: 'TASK_ASSIGNED',
    channel: 'IN_APP',
    priority: 'HIGH',
    title: '🔔 Real-time Push Notification Success',
    body: `We created a unique task: "${task.title}". Click me to open it!`,
    entityType: 'task',
    entityId: task.id,
    metadata: {
      eventId: `evt-thomas-verification-${Date.now()}`,
      spaceId: spaceId,
      taskId: task.id,
      title: task.title,
      actorName: 'System Bot',
    }
  });

  console.log('✅ Notification queued successfully!');
  await app.close();
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
});
