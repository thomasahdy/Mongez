import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { SubmitDecisionDto } from './dto/submit-decision.dto';
import { WorkflowFilterDto } from './dto/workflow-filter.dto';

@ApiTags('Workflow')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // ── Definitions ──────────────────────────────────────────────

  @Get('workflow/definitions')
  @ApiOperation({ summary: 'List available workflow definitions for a space' })
  async listDefinitions(@Query('spaceId') spaceId: string) {
    return this.workflowService.listDefinitions(spaceId);
  }

  @Post('workflow/definitions')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['manage', 'workflow'])
  @ApiOperation({ summary: 'Create a new workflow definition (admin only)' })
  async createDefinition(@Req() req: any, @Body() dto: CreateWorkflowDefinitionDto) {
    return this.workflowService.createDefinition(dto.spaceId, req.user.userId, dto);
  }

  @Patch('workflow/definitions/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(['manage', 'workflow'])
  @ApiOperation({ summary: 'Update a workflow definition (admin only)' })
  async updateDefinition(
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; isActive: boolean }>,
  ) {
    return this.workflowService.updateDefinition(id, body);
  }

  // ── Instances ────────────────────────────────────────────────

  @Post('workflow/start')
  @ApiOperation({ summary: 'Start a new workflow instance' })
  async startWorkflow(@Req() req: any, @Body() dto: StartWorkflowDto) {
    return this.workflowService.startWorkflow(req.user.userId, dto);
  }

  @Get('workflow/pending')
  @ApiOperation({ summary: 'My pending review queue' })
  async getPending(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Query() filters: WorkflowFilterDto,
  ) {
    return this.workflowService.getPendingForReviewer(req.user.userId, spaceId, filters);
  }

  @Get('workflow/my-requests')
  @ApiOperation({ summary: 'Workflows I initiated' })
  async getMyRequests(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Query() filters: WorkflowFilterDto,
  ) {
    return this.workflowService.getMyRequests(req.user.userId, spaceId, filters);
  }

  @Get('workflow/instances/:id')
  @ApiOperation({ summary: 'Get full instance with history' })
  async getInstance(@Param('id') id: string) {
    return this.workflowService.getInstanceHistory(id);
  }

  @Post('workflow/instances/:id/approve')
  @ApiOperation({ summary: 'Submit approval decision' })
  async approve(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitDecisionDto,
  ) {
    return this.workflowService.submitDecision(id, req.user.userId, 'APPROVED', dto.note);
  }

  @Post('workflow/instances/:id/reject')
  @ApiOperation({ summary: 'Submit rejection decision' })
  async reject(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitDecisionDto,
  ) {
    return this.workflowService.submitDecision(id, req.user.userId, 'REJECTED', dto.note);
  }

  @Delete('workflow/instances/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a workflow instance (requester only)' })
  async cancel(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.workflowService.cancelInstance(id, req.user.userId);
  }
}