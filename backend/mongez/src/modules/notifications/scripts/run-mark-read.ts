import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  console.log('🚀 Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const notificationsService = app.get(NotificationsService);
  const prisma = app.get(PrismaService);

  // 1. Fetch Thomas Magdy user
  const thomas = await prisma.user.findFirst({
    where: { name: { contains: 'Thomas' } }
  });

  if (!thomas) {
    console.error('❌ Thomas Magdy user not found!');
    await app.close();
    return;
  }

  // 2. Fetch the pending notification
  const notif = await prisma.notification.findFirst({
    where: { userId: thomas.id, status: 'PENDING' }
  });

  if (!notif) {
    console.log('❌ No pending notifications found in the DB for Thomas.');
    await app.close();
    return;
  }

  console.log(`🔔 Found notification: "${notif.title}" (ID: ${notif.id}) for Space: ${notif.spaceId}`);

  // 3. Call notificationsService.markAsRead
  try {
    console.log('⚡ Calling markAsRead...');
    const result = await notificationsService.markAsRead(notif.id, thomas.id, notif.spaceId || '');
    console.log('✅ Success! Returned notification:', result);
  } catch (err: any) {
    console.error('❌ ERROR in markAsRead:', err);
  }

  await app.close();
}

bootstrap().catch(err => {
  console.error(err);
});
