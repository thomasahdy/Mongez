import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  console.log('🚀 Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const notificationsService = app.get(NotificationsService);
  const prisma = app.get(PrismaService);

  // 1. Fetch all spaces
  const spaces = await prisma.space.findMany({
    select: { id: true, name: true }
  });

  if (spaces.length === 0) {
    console.error('❌ ERROR: No spaces found in the database. Run seed first!');
    await app.close();
    process.exit(1);
  }

  // 2. Fetch all users
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true }
  });

  console.log(`Resolved ${spaces.length} spaces and ${users.length} users in the database.`);

  // 3. For each space, trigger notifications for all users
  for (const space of spaces) {
    console.log(`\n📦 Processing Space: "${space.name}" (ID: ${space.id})...`);
    
    // Find a task in this space if possible
    const task = await prisma.task.findFirst({
      where: {
        board: {
          department: {
            spaceId: space.id
          }
        }
      },
      select: { id: true, title: true }
    });

    const entityId = task?.id || 'test-entity-id';
    const taskTitle = task?.title || 'System Maintenance Dashboard';

    for (const user of users) {
      console.log(`  🔔 Sending notification to ${user.name} for space "${space.name}"...`);
      await notificationsService.queueNotification({
        userId: user.id,
        spaceId: space.id,
        type: 'TASK_ASSIGNED',
        channel: 'IN_APP',
        priority: 'HIGH',
        title: '📋 Task Assignment Alert',
        body: `You have been assigned to: "${taskTitle}" in workspace "${space.name}".`,
        entityType: 'task',
        entityId: entityId,
        metadata: {
          eventId: `evt-trigger-${space.id}-${user.id}-${Date.now()}`,
          spaceId: space.id,
          taskId: entityId,
          title: taskTitle,
          actorName: 'System Administrator',
        }
      });
    }
  }

  console.log('\n✅ All space-scoped notifications queued to BullMQ successfully!');

  await app.close();
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
});
