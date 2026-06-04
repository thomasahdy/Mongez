import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DEFAULT_ROLES } from '../constants/roles.constant';

@Injectable()
export class RoleSeedService implements OnModuleInit {
  private readonly logger = new Logger(RoleSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultRoles();
  }

  async seedDefaultRoles(): Promise<void> {
    try {
      for (const role of DEFAULT_ROLES) {
        const existing = await this.prisma.role.findUnique({
          where: { name: role.name },
        });

        if (!existing) {
          await this.prisma.role.create({
            data: {
              name: role.name,
              description: role.description,
            },
          });
          this.logger.log(`Created default role: ${role.name}`);
        } else {
          this.logger.log(`Role already exists: ${role.name}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to seed default roles', error);
      throw error;
    }
  }
}