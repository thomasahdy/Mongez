import { Controller, Get, Patch, Delete, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AdminService } from './admin.service';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Platform Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide analytics & stats (DAU, MAU, storage, AI requests)' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all platform users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listUsers(@Query() pagination: PaginationDto) {
    const page = Number(pagination.page || 1);
    const limit = Number(pagination.limit || 20);
    return this.adminService.listUsers(page, limit);
  }

  @Get('spaces')
  @ApiOperation({ summary: 'List all spaces / organizations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listSpaces(@Query() pagination: PaginationDto) {
    const page = Number(pagination.page || 1);
    const limit = Number(pagination.limit || 20);
    return this.adminService.listSpaces(page, limit);
  }

  @Patch('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account and terminate their active sessions' })
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Delete('spaces/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a space / organization and all its data' })
  async deleteSpace(@Param('id') id: string) {
    await this.adminService.deleteSpace(id);
  }
}
