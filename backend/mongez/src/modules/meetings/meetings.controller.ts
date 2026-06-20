import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MeetingsService } from './meetings.service';

@ApiTags('Meetings')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all meetings in a space' })
  async listMeetings(@Query('spaceId') spaceId: string) {
    return this.meetingsService.listMeetings(spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get meeting details by ID' })
  async getMeeting(@Param('id') id: string, @Query('spaceId') spaceId: string) {
    return this.meetingsService.getMeeting(id, spaceId);
  }

  @Get(':id/transcript')
  @ApiOperation({ summary: 'Get meeting transcript text' })
  async getTranscript(@Param('id') id: string, @Query('spaceId') spaceId: string) {
    return this.meetingsService.getTranscript(id, spaceId);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a meeting audio file for transcription and summarization' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadMeeting(
    @Req() req: any,
    @Query('spaceId') spaceId: string,
    @Body('title') title: string,
    @UploadedFile() file: any,
  ) {
    return this.meetingsService.uploadMeeting(spaceId, req.user.userId, title || 'Meeting Audio', file);
  }

  @Post('proposed-tasks/:id/approve')
  @ApiOperation({ summary: 'Approve a proposed task and create it in the board' })
  async approveProposedTask(
    @Req() req: any,
    @Param('id') id: string,
    @Query('spaceId') spaceId: string,
    @Body('boardId') boardId: string,
    @Body('columnId') columnId: string,
  ) {
    return this.meetingsService.approveProposedTask(id, spaceId, req.user.userId, boardId, columnId);
  }

  @Post('proposed-tasks/:id/reject')
  @ApiOperation({ summary: 'Reject a proposed task' })
  async rejectProposedTask(
    @Param('id') id: string,
    @Query('spaceId') spaceId: string,
  ) {
    return this.meetingsService.rejectProposedTask(id, spaceId);
  }
}
