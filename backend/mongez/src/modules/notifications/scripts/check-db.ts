import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  // 1. Fetch Thomas Magdy user
  const thomas = await prisma.user.findFirst({
    where: { name: { contains: 'Thomas' } }
  });

  if (!thomas) {
    console.log('❌ Thomas Magdy not found in User table!');
    await app.close();
    return;
  }

  console.log(`👤 Found user: ${thomas.name} (ID: ${thomas.id}, Email: ${thomas.email})`);

  // 2. Query all notifications for Thomas Magdy
  const notifications = await prisma.notification.findMany({
    where: { userId: thomas.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId: thomas.id }
  });

  console.log(`\n⚙️ Preferences for Thomas Magdy:`, JSON.stringify(preferences, null, 2));

  console.log(`\n🔔 Recent 10 notifications for Thomas Magdy (Total in DB: ${await prisma.notification.count({ where: { userId: thomas.id } })}):`);
  for (const n of notifications) {
    console.log(`- ID: ${n.id} | Space: ${n.spaceId} | Type: ${n.type} | Title: "${n.title}" | Status: ${n.status} | CreatedAt: ${n.createdAt.toISOString()}`);
  }

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
});
