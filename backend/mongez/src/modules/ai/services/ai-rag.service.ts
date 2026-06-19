import { Injectable, Logger } from '@nestjs/common';
import { AIClientService } from '../ai-client.service';

@Injectable()
export class AIRagService {
  private readonly logger = new Logger(AIRagService.name);

  constructor(private readonly aiClient: AIClientService) {}

  async indexDocument(spaceId: string, taskId: string): Promise<void> {
    try {
      this.logger.log(`Indexing document for space ${spaceId}, task ${taskId}`);
      await this.aiClient.indexDocument({ spaceId, taskId });
    } catch (err: any) {
      this.logger.error(`Failed to index document for space ${spaceId}, task ${taskId}: ${err.message}`);
      // Don't throw to prevent background queue crashes, just log
    }
  }

  async retrieveContext(spaceId: string, query: string): Promise<string> {
    try {
      this.logger.log(`Retrieving semantic context for space ${spaceId}, query "${query}"`);
      const result = await this.aiClient.retrieveContext({ spaceId, query });
      return result.context || '';
    } catch (err: any) {
      this.logger.error(`Failed to retrieve semantic context: ${err.message}`);
      return '';
    }
  }
}
