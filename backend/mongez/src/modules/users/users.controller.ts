import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  async getMe(@Req() req: any) {
    return this.usersService.getById(req.user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (name, avatar, language)' })
  async updateMe(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload own avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: join(tmpdir(), 'mongez-avatar-uploads') }),
  }))
  async uploadAvatar(@Req() req: any, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No avatar file provided');
    }

    const buffer = await this.getUploadedFileBuffer(file);
    if (!buffer.length) {
      throw new BadRequestException(
        `Avatar upload reached backend with empty content (name: ${file.originalname || 'unknown'}, size: ${file.size ?? 'unknown'}, type: ${file.mimetype || 'unknown'})`,
      );
    }

    return this.usersService.uploadAvatar(req.user.userId, {
      buffer,
      mimeType: file.mimetype,
      originalName: file.originalname,
    });
  }

  private async getUploadedFileBuffer(file: any): Promise<Buffer> {
    if (Buffer.isBuffer(file?.buffer) && file.buffer.length > 0) {
      return file.buffer;
    }

    if (file?.path) {
      try {
        return await readFile(file.path);
      } finally {
        await unlink(file.path).catch(() => undefined);
      }
    }

    if (file?.stream?.readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of file.stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    return Buffer.alloc(0);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change password (requires current password, revokes all sessions)' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.usersService.changePassword(req.user.userId, dto);
  }

  @Get('me/send-verification')
  @ApiOperation({ summary: 'Send email verification link to current user' })
  async sendVerification(@Req() req: any): Promise<{ message: string }> {
    await this.usersService.sendVerificationEmail(req.user.userId);
    return { message: 'Verification email queued' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address using token from link' })
  async verifyEmail(@Query('token') token: string) {
    return this.usersService.verifyEmail(token);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any, 'OWNER' as any)
  @ApiOperation({ summary: 'List all users — admin only' })
  async getAll(@Query() pagination: PaginationDto) {
    return this.usersService.getAll(pagination.page, pagination.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (used for @mention resolution)' })
  @ApiResponse({ status: 200, description: 'User profile (safe fields only)' })
  async getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN' as any, 'OWNER' as any)
  @ApiOperation({ summary: 'Update user account status — admin only' })
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(id, req.user.userId, dto);
  }

  @Get('me/preferences')
  @ApiOperation({ summary: 'Get own preferences' })
  async getPreferences(@Req() req: any) {
    return this.usersService.getPreferences(req.user.userId);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Update own preferences' })
  async updatePreferences(@Req() req: any, @Body() dto: import('./dto/update-preference.dto').UpdatePreferenceDto) {
    return this.usersService.updatePreferences(req.user.userId, dto);
  }
}
