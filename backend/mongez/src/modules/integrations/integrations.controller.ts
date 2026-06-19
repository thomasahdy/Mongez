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

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') userId: string,
    @Res() res: Response,
  ) {
    await this.integrationsService.connectGoogleDrive(userId, code);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings/integrations?connected=google`);
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

  @Post('../tasks/:taskId/drive-files')
  @UseGuards(JwtAuthGuard, TaskAccessGuard)
  async attachDriveFile(
    @Param('taskId') taskId: string,
    @Body() dto: AttachDriveFileDto,
    @Req() req: any,
  ) {
    const userId = req.user.userId;
    return this.integrationsService.attachDriveFile(taskId, userId, dto);
  }

  @Get('../tasks/:taskId/drive-files')
  @UseGuards(JwtAuthGuard, TaskAccessGuard)
  async listAttachments(@Param('taskId') taskId: string) {
    return this.integrationsService.listAttachments(taskId);
  }

  @Delete('../drive-files/:id')
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
