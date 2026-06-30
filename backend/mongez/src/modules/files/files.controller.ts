import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TaskAccessGuard } from '../tasks/guards/task-access.guard';
import { FilesService } from './files.service';
import { FileFilterDto } from './dto/file-filter.dto';

@ApiTags('Files')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('tasks/:taskId/files')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'Upload a file attachment to a task' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: any,
    @Param('taskId') taskId: string,
    @UploadedFile() file: any,
  ) {
    return this.filesService.upload(file, taskId, req.user.userId, req.taskSpaceId);
  }

  @Get('tasks/:taskId/files')
  @UseGuards(TaskAccessGuard)
  @ApiOperation({ summary: 'List attachments for a task' })
  async listForTask(
    @Param('taskId') taskId: string,
    @Query() filters: FileFilterDto,
  ) {
    return this.filesService.listForTask(taskId, filters);
  }

  @Get('files/:fileId/download')
  @ApiOperation({ summary: 'Redirect to signed download URL for a file' })
  async getDownloadUrl(@Req() req: any, @Param('fileId') fileId: string, @Res() res: any) {
    const url = await this.filesService.getDownloadUrl(fileId, req.user.userId);
    return res.redirect(url);
  }

  @Get('files/key/:key/download')
  @ApiOperation({ summary: 'Download file by storage key' })
  async downloadByKey(
    @Req() req: any,
    @Param('key') key: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() res: any,
  ) {
    const { buffer, fileName, mimeType } = await this.filesService.downloadByKey(
      decodeURIComponent(key),
      req.user?.userId,
      expires,
      signature,
    );
    res.setHeader('Content-Type', mimeType);
    const disposition = mimeType.startsWith('image/') ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    res.send(buffer);
  }

  @Get('files/:fileId/versions')
  @ApiOperation({ summary: 'Get version history for a file' })
  async getVersions(@Param('fileId') fileId: string) {
    return this.filesService.getVersions(fileId);
  }

  @Delete('files/:fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a file' })
  async delete(@Req() req: any, @Param('fileId') fileId: string): Promise<void> {
    await this.filesService.softDelete(fileId, req.user.userId);
  }
}
