import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskAccessGuard } from '../tasks/guards/task-access.guard';
import { IntegrationsService } from './integrations.service';
import { AttachDriveFileDto } from './dto/attach-drive-file.dto';
import { ConfigService } from '@nestjs/config';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly config: ConfigService,
  ) {}

  @Get('google/auth')
  @UseGuards(JwtAuthGuard)
  googleAuth(@Req() req: any, @Res() res: Response) {
    const userId = req.user.userId;
    const url = this.integrationsService.generateAuthUrl(userId);
    res.redirect(url);
  }



  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    const userId = req.user.userId;
    return this.integrationsService.getStatus(userId);
  }

  @Delete('google')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@Req() req: any) {
    const userId = req.user.userId;
    await this.integrationsService.disconnect(userId);
  }

  @Get('google/drive/files')
  @UseGuards(JwtAuthGuard)
  async listDriveFiles(@Req() req: any, @Query('q') query?: string) {
    const userId = req.user.userId;
    return this.integrationsService.listDriveFiles(userId, query);
  }

  @Post('google/drive/tasks/:taskId/files')
  @UseGuards(JwtAuthGuard, TaskAccessGuard)
  async attachDriveFile(
    @Param('taskId') taskId: string,
    @Body() dto: AttachDriveFileDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.integrationsService.attachDriveFile(taskId, userId, dto);
  }

  @Get('google/drive/tasks/:taskId/files')
  @UseGuards(JwtAuthGuard, TaskAccessGuard)
  async listAttachments(@Param('taskId') taskId: string) {
    return this.integrationsService.listAttachments(taskId);
  }

  @Delete('google/drive/files/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAttachment(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.userId;
    await this.integrationsService.removeAttachment(id, userId);
  }

  @Post('google/webhook')
  @HttpCode(HttpStatus.OK)
  async handleDriveWebhook(@Headers() headers: Record<string, string>) {
    await this.integrationsService.handleDriveWebhook(headers);
  }
}
