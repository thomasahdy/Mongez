import { SlaService } from './sla.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SlaService', () => {
  let service: SlaService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      slaMetric: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    } as any;

    service = new SlaService(prisma);
  });

  describe('recordMetric()', () => {
    it('should calculate isViolated as false if actualHours <= targetHours', async () => {
      prisma.slaMetric.create.mockResolvedValue({ id: 'metric-1' } as any);

      await service.recordMetric('space-1', 'instance-1', 1, 24, 20);

      expect(prisma.slaMetric.create).toHaveBeenCalledWith({
        data: {
          spaceId: 'space-1',
          workflowInstanceId: 'instance-1',
          stepOrder: 1,
          targetHours: 24,
          actualHours: 20,
          isViolated: false,
        },
      });
    });

    it('should calculate isViolated as true if actualHours > targetHours', async () => {
      prisma.slaMetric.create.mockResolvedValue({ id: 'metric-2' } as any);

      await service.recordMetric('space-1', 'instance-1', 2, 24, 30);

      expect(prisma.slaMetric.create).toHaveBeenCalledWith({
        data: {
          spaceId: 'space-1',
          workflowInstanceId: 'instance-1',
          stepOrder: 2,
          targetHours: 24,
          actualHours: 30,
          isViolated: true,
        },
      });
    });
  });

  describe('getSlaCompliance()', () => {
    it('should return default values when no metrics exist', async () => {
      prisma.slaMetric.findMany.mockResolvedValue([]);

      const result = await service.getSlaCompliance('space-1');

      expect(result).toEqual({
        complianceRate: 100,
        totalSteps: 0,
        violatedSteps: 0,
        averageActualHours: 0,
      });
    });

    it('should compute compliance rate and average hours when metrics exist', async () => {
      prisma.slaMetric.findMany.mockResolvedValue([
        { id: '1', actualHours: 10, isViolated: false },
        { id: '2', actualHours: 25, isViolated: true },
        { id: '3', actualHours: 5, isViolated: false },
        { id: '4', actualHours: 20, isViolated: false },
      ] as any);

      const result = await service.getSlaCompliance('space-1');

      // compliance rate: 3/4 = 75%
      // avg actual hours: (10 + 25 + 5 + 20) / 4 = 60 / 4 = 15
      expect(result).toEqual({
        complianceRate: 75,
        totalSteps: 4,
        violatedSteps: 1,
        averageActualHours: 15,
        metrics: expect.any(Array),
      });
      expect(result.metrics).toHaveLength(4);
    });
  });
});
