import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  const userId = 'cmxb3h1n900003h35u6x8y1z9';
  const spaceId = 'cmxb3h1o300013h35o8a2d1e0';

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const space = await prisma.space.findUnique({ where: { id: spaceId } });

  console.log('USER EXISTS:', !!user, user);
  console.log('SPACE EXISTS:', !!space, space);

  await app.close();
}

bootstrap().catch(console.error);
