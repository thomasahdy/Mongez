import { Module } from '@nestjs/common';
import { PrometheusController } from './prometheus.controller';

@Module({
  controllers: [PrometheusController],
})
export class ObservabilityModule {}
