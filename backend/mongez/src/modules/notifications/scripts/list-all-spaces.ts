import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const spaces = await prisma.space.findMany();
  console.log('ALL SPACES:', spaces);

  const memberships = await prisma.membership.findMany({
    include: {
      user: { select: { email: true } },
      space: { select: { name: true } }
    }
  });
  console.log('ALL MEMBERSHIPS:', memberships);

  await app.close();
}

bootstrap().catch(console.error);
