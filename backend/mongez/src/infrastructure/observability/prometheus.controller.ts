import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { register, collectDefaultMetrics } from 'prom-client';

@Controller('metrics')
export class PrometheusController {
  constructor() {
    // Collect default system metrics (CPU, memory, garbage collection, etc.)
    collectDefaultMetrics({ register });
  }

  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  }
}
