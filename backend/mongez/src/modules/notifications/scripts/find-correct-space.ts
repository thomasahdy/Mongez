import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const userId = 'cmxb3h1n900003h35u6x8y1z9';
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { space: true }
  });

  console.log('MEMBERSHIPS:', memberships);

  await app.close();
}

bootstrap().catch(console.error);
