import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { TasksService } from '../tasks/tasks.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ApprovalStatus, Meeting } from '@prisma/client';
import { UploadedFile } from '../files/files.service';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly tasksService: TasksService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async checkSpaceMembership(userId: string, spaceId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_spaceId: { userId, spaceId } },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace.');
    }
  }

  async listMeetings(spaceId: string, userId: string) {
    await this.checkSpaceMembership(userId, spaceId);
    return this.prisma.meeting.findMany({
      where: { spaceId },
      include: { proposedTasks: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMeeting(id: string, spaceId: string, userId: string) {
    await this.checkSpaceMembership(userId, spaceId);
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, spaceId },
      include: { proposedTasks: true },
    });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  async uploadMeeting(spaceId: string, userId: string, title: string, file: UploadedFile): Promise<Meeting> {
    await this.checkSpaceMembership(userId, spaceId);
    if (!file) throw new BadRequestException('No meeting audio file provided.');

    // 1. Upload raw audio file to storage (S3/MinIO/Local)
    const audioKey = this.storage.buildKey(spaceId, 'meetings/audio', 'meeting', file.originalname);
    await this.storage.upload(audioKey, file.buffer, file.mimetype);

    // Get signed URL for the audio file so FastAPI can download and parse if needed,
    // or we can pass the raw file buffer directly in a multipart request.
    const aiServiceUrl = this.config.get<string>('ai.serviceUrl') || 'http://localhost:8000';
    const aiApiKey = this.config.get<string>('ai.serviceApiKey') || 'dev-key';

    let analysisResult: any;

    try {
      // 2. Call FastAPI /meetings/analyze to transcribe and summarize
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });

      const response = await firstValueFrom(
        this.httpService.post(`${aiServiceUrl}/meetings/analyze`, form, {
          headers: {
            ...form.getHeaders(),
            'X-Service-API-Key': aiApiKey,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }),
      );

      analysisResult = response.data;
    } catch (err: any) {
      // Cleanup uploaded audio if AI processing failed
      await this.storage.delete(audioKey).catch(() => {});
      throw new BadRequestException(`AI meeting analysis failed: ${err.response?.data?.detail || err.message}`);
    }

    const { transcript, summary } = analysisResult;

    // 3. Upload raw transcript text to storage (S3/MinIO) to avoid DB bloat
    const transcriptKey = this.storage.buildKey(spaceId, 'meetings/transcripts', 'meeting', 'transcript.txt');
    await this.storage.upload(transcriptKey, Buffer.from(transcript, 'utf-8'), 'text/plain');

    // 4. Store Meeting row in the database
    const meeting = await this.prisma.meeting.create({
      data: {
        spaceId,
        title: summary.title || title,
        description: summary.description || null,
        audioUrl: audioKey,
        transcriptUrl: transcriptKey,
        summary: summary || {},
        createdById: userId,
      },
    });

    // 5. Store ProposedTasks in the database
    if (summary.action_items && summary.action_items.length > 0) {
      for (const item of summary.action_items) {
        let assigneeId: string | null = null;
        if (item.assignee_email) {
          const user = await this.prisma.user.findUnique({
            where: { email: item.assignee_email },
            select: { id: true },
          });
          assigneeId = user?.id || null;
        }

        await this.prisma.proposedTask.create({
          data: {
            meetingId: meeting.id,
            spaceId,
            title: item.title,
            description: item.description || null,
            assigneeId,
            dueDate: item.due_date ? new Date(item.due_date) : null,
            status: ApprovalStatus.PENDING,
          },
        });
      }
    }

    return this.prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: { proposedTasks: true },
    }) as Promise<Meeting>;
  }

  async approveProposedTask(proposedTaskId: string, spaceId: string, userId: string, boardId: string, columnId: string) {
    await this.checkSpaceMembership(userId, spaceId);
    const proposedTask = await this.prisma.proposedTask.findFirst({
      where: { id: proposedTaskId, spaceId },
    });

    if (!proposedTask) {
      throw new NotFoundException('Proposed task not found');
    }

    if (proposedTask.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Proposed task is already ${proposedTask.status}`);
    }

    // Retrieve Space Prefix
    const space = await this.prisma.space.findUnique({
      where: { id: spaceId },
      select: { prefix: true },
    });
    const spacePrefix = space?.prefix || 'TASK';

    // 1. Create task using TasksService to ensure proper sequence generation and event publishing
    const task = await this.tasksService.createTask(
      {
        title: proposedTask.title,
        description: proposedTask.description || undefined,
        boardId,
        columnId,
        spaceId,
        spacePrefix,
        dueDate: proposedTask.dueDate ? proposedTask.dueDate.toISOString() : undefined,
        assigneeIds: proposedTask.assigneeId ? [proposedTask.assigneeId] : [],
      },
      userId,
      spaceId,
      spacePrefix,
    );

    // 2. Update ProposedTask status
    return this.prisma.proposedTask.update({
      where: { id: proposedTaskId },
      data: {
        status: ApprovalStatus.APPROVED,
        taskId: task.id,
      },
    });
  }

  async rejectProposedTask(proposedTaskId: string, spaceId: string, userId: string) {
    await this.checkSpaceMembership(userId, spaceId);
    const proposedTask = await this.prisma.proposedTask.findFirst({
      where: { id: proposedTaskId, spaceId },
    });

    if (!proposedTask) {
      throw new NotFoundException('Proposed task not found');
    }

    if (proposedTask.status !== ApprovalStatus.PENDING) {
      throw new BadRequestException(`Proposed task is already ${proposedTask.status}`);
    }

    return this.prisma.proposedTask.update({
      where: { id: proposedTaskId },
      data: {
        status: ApprovalStatus.REJECTED,
      },
    });
  }

  async getTranscript(meetingId: string, spaceId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId, spaceId, userId);
    if (!meeting.transcriptUrl) {
      throw new NotFoundException('Transcript file not found');
    }

    const buffer = await this.storage.download(meeting.transcriptUrl);
    return {
      transcript: buffer.toString('utf-8'),
    };
  }
}
