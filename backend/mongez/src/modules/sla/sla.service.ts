import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  async recordMetric(
    spaceId: string,
    workflowInstanceId: string,
    stepOrder: number,
    targetHours: number,
    actualHours: number,
  ) {
    const isViolated = actualHours > targetHours;

    return this.prisma.slaMetric.create({
      data: {
        spaceId,
        workflowInstanceId,
        stepOrder,
        targetHours,
        actualHours,
        isViolated,
      },
    });
  }

  async getSlaCompliance(spaceId: string) {
    const metrics = await this.prisma.slaMetric.findMany({
      where: { spaceId },
    });

    if (!metrics.length) {
      return {
        complianceRate: 100,
        totalSteps: 0,
        violatedSteps: 0,
        averageActualHours: 0,
      };
    }

    const violatedSteps = metrics.filter((m) => m.isViolated).length;
    const complianceRate = Math.round(((metrics.length - violatedSteps) / metrics.length) * 100);
    const sumActualHours = metrics.reduce((sum, m) => sum + m.actualHours, 0);
    const averageActualHours = Number((sumActualHours / metrics.length).toFixed(1));

    return {
      complianceRate,
      totalSteps: metrics.length,
      violatedSteps,
      averageActualHours,
      metrics: metrics.slice(0, 50), // Return recent metrics
    };
  }
}
