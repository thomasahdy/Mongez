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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacesService } from './spaces.service';
import { SpaceMemberGuard, SpaceRoles } from './guards/space-member.guard';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/membership.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@ApiTags('Spaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  // ─── Spaces ────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new space' })
  async create(@Req() req: any, @Body() dto: CreateSpaceDto) {
    return this.spacesService.create(dto, req.user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List spaces I belong to' })
  async getAll(@Req() req: any, @Query() pagination: PaginationDto) {
    return this.spacesService.getAll(req.user.userId, pagination.page, pagination.limit);
  }

  @Get(':id')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Get space details' })
  async getById(@Param('id') id: string) {
    return this.spacesService.getById(id);
  }

  @Patch(':id')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update space metadata' })
  async update(@Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return this.spacesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete space (cascade all data) — owner only' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.spacesService.delete(id);
  }

  @Get(':id/stats')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Get task counts by status and member count' })
  async getStats(@Param('id') id: string) {
    return this.spacesService.getStats(id);
  }

  // ─── Departments ───────────────────────────────────────────

  @Get(':id/departments')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'List departments in space' })
  async getDepartments(@Param('id') spaceId: string) {
    return this.spacesService.getDepartments(spaceId);
  }

  @Post(':id/departments')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a department' })
  async createDepartment(@Param('id') spaceId: string, @Body() dto: CreateDepartmentDto) {
    return this.spacesService.createDepartment(spaceId, dto);
  }

  @Patch(':spaceId/departments/:deptId')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a department' })
  async updateDepartment(@Param('deptId') deptId: string, @Body() dto: UpdateDepartmentDto) {
    return this.spacesService.updateDepartment(deptId, dto);
  }

  @Delete(':spaceId/departments/:deptId')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a department (fails if it has boards)' })
  async deleteDepartment(@Param('deptId') deptId: string): Promise<void> {
    await this.spacesService.deleteDepartment(deptId);
  }

  // ─── Members ───────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'List space members with roles' })
  async getMembers(@Param('id') spaceId: string) {
    return this.spacesService.getMembers(spaceId);
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Change a member\'s role' })
  async changeRole(
    @Req() req: any,
    @Param('id') spaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.spacesService.changeRole(spaceId, userId, dto, req.user.userId);
  }

  @Delete(':id/members/:userId')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member from space' })
  async removeMember(
    @Req() req: any,
    @Param('id') spaceId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.spacesService.removeMember(spaceId, userId, req.user.userId);
  }

  @Delete(':id/members/me')
  @UseGuards(SpaceMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave space' })
  async leaveSpace(@Req() req: any, @Param('id') spaceId: string): Promise<void> {
    await this.spacesService.leaveSpace(spaceId, req.user.userId);
  }

  // ─── Invitations ───────────────────────────────────────────

  @Post(':id/invitations')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Invite a user by email' })
  async inviteMember(@Param('id') spaceId: string, @Body() dto: InviteMemberDto) {
    return this.spacesService.inviteMember(spaceId, dto);
  }

  @Get(':id/invitations')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List pending invitations' })
  async getPendingInvitations(@Param('id') spaceId: string) {
    return this.spacesService.getPendingInvitations(spaceId);
  }

  @Delete(':id/invitations/:inviteId')
  @UseGuards(SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a pending invitation' })
  async cancelInvitation(@Param('inviteId') inviteId: string): Promise<void> {
    await this.spacesService.cancelInvitation(inviteId);
  }
}

// ─── Separate controller for invitation accept (no space param) ───

@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get('accept')
  @ApiOperation({ summary: 'Accept an invitation using the token from email link' })
  async acceptInvitation(@Req() req: any, @Query('token') token: string) {
    return this.spacesService.acceptInvitation(token, req.user.userId);
  }
}