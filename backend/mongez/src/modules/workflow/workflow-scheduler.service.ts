import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';

@Injectable()
export class WorkflowSchedulerService {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    private readonly workflowService: WorkflowService,
    private readonly repo: WorkflowRepository,
  ) {}

  // Every 15 minutes — check for timed-out workflow steps
  @Cron('*/15 * * * *')
  async checkWorkflowTimeouts() {
    this.logger.debug('Running scheduled workflow timeout check...');
    try {
      const timedOut = await this.repo.findTimedOutSteps();
      if (!timedOut.length) return;

      this.logger.log(`Found ${timedOut.length} timed-out workflow step(s). Processing...`);

      for (const instance of timedOut) {
        try {
          await this.workflowService.handleStepTimeout(instance.id, instance.currentStep);
        } catch (err) {
          this.logger.error(
            `Failed to handle timeout for workflow ${instance.id}`,
            (err as Error).stack,
          );
        }
      }
    } catch (err) {
      this.logger.error('Workflow timeout check failed', (err as Error).stack);
    }
  }
}