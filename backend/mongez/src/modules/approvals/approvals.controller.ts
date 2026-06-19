import {
  Controller,
  Post,
  Get,
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskAccessGuard } from '../tasks/guards/task-access.guard';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ResolveApprovalDto } from './dto/resolve-approval.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Post('tasks/:taskId/approvals')
  @UseGuards(TaskAccessGuard)
  async requestApproval(
    @Param('taskId') taskId: string,
    @Body() dto: CreateApprovalDto,
    @Req() req: any,
  ) {
    const requesterId = req.user.userId;
    dto.taskId = taskId;
    return this.approvalsService.requestApproval(dto, requesterId);
  }

  @Get('tasks/:taskId/approvals')
  @UseGuards(TaskAccessGuard)
  async listForTask(
    @Param('taskId') taskId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.approvalsService.listForTask(
      taskId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Get('approvals/pending')
  async getPendingForReviewer(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const reviewerId = req.user.userId;
    return this.approvalsService.getPendingForReviewer(
      reviewerId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('approvals/:id')
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
    @Req() req: any,
  ) {
    const reviewerId = req.user.userId;
    return this.approvalsService.resolve(id, reviewerId, dto);
  }

  @Delete('approvals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async withdraw(@Param('id') id: string, @Req() req: any) {
    const requesterId = req.user.userId;
    await this.approvalsService.withdraw(id, requesterId);
  }
}
