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
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpacesService } from './spaces.service';
import { SpaceMemberGuard, SpaceRoles } from './guards/space-member.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/membership.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { AuditLog } from '../../common/decorators/audit-log.decorator';

@ApiTags('Spaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  // ─── Spaces ────────────────────────────────────────────────

  @Post()
  @AuditLog({ action: 'space.created', entityType: 'Space' })
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
  @AuditLog({ action: 'space.updated', entityType: 'Space', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'space'])
  @ApiOperation({ summary: 'Update space metadata' })
  async update(@Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return this.spacesService.update(id, dto);
  }

  @Delete(':id')
  @AuditLog({ action: 'space.deleted', entityType: 'Space', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER')
  @RequirePermissions(['delete', 'space'])
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

  @Post(':id/export')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'Request workspace JSON export (runs in background)' })
  async requestExport(@Req() req: any, @Param('id') id: string) {
    return this.spacesService.requestExport(id, req.user.userId);
  }

  // ─── Departments ───────────────────────────────────────────

  @Get(':id/departments')
  @UseGuards(SpaceMemberGuard)
  @ApiOperation({ summary: 'List departments in space' })
  async getDepartments(@Param('id') spaceId: string) {
    return this.spacesService.getDepartments(spaceId);
  }

  @Post(':id/departments')
  @AuditLog({ action: 'department.created', entityType: 'Department', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'board'])
  @ApiOperation({ summary: 'Create a department' })
  async createDepartment(@Param('id') spaceId: string, @Body() dto: CreateDepartmentDto) {
    return this.spacesService.createDepartment(spaceId, dto);
  }

  @Patch(':spaceId/departments/:deptId')
  @AuditLog({ action: 'department.updated', entityType: 'Department', entityIdParam: 'deptId' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'board'])
  @ApiOperation({ summary: 'Update a department' })
  async updateDepartment(@Param('deptId') deptId: string, @Body() dto: UpdateDepartmentDto) {
    return this.spacesService.updateDepartment(deptId, dto);
  }

  @Delete(':spaceId/departments/:deptId')
  @AuditLog({ action: 'department.deleted', entityType: 'Department', entityIdParam: 'deptId' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['delete', 'board'])
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
  @AuditLog({ action: 'membership.role_changed', entityType: 'Membership', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'member'])
  @ApiOperation({ summary: "Change a member's role" })
  async changeRole(
    @Req() req: any,
    @Param('id') spaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.spacesService.changeRole(spaceId, userId, dto, req.user.userId);
  }

  @Delete(':id/members/:userId')
  @AuditLog({ action: 'membership.member_removed', entityType: 'Membership', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'member'])
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
  @AuditLog({ action: 'membership.leave', entityType: 'Membership', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave space' })
  async leaveSpace(@Req() req: any, @Param('id') spaceId: string): Promise<void> {
    await this.spacesService.leaveSpace(spaceId, req.user.userId);
  }

  // ─── Invitations ───────────────────────────────────────────

  @Post(':id/invitations')
  @AuditLog({ action: 'invitation.created', entityType: 'Invitation', entityIdParam: 'id' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'member'])
  @ApiOperation({ summary: 'Invite a user by email' })
  async inviteMember(@Param('id') spaceId: string, @Body() dto: InviteMemberDto) {
    return this.spacesService.inviteMember(spaceId, dto);
  }

  @Get(':id/invitations')
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['read', 'member'])
  @ApiOperation({ summary: 'List pending invitations' })
  async getPendingInvitations(@Param('id') spaceId: string) {
    return this.spacesService.getPendingInvitations(spaceId);
  }

  @Delete(':id/invitations/:inviteId')
  @AuditLog({ action: 'invitation.cancelled', entityType: 'Invitation', entityIdParam: 'inviteId' })
  @UseGuards(SpaceMemberGuard, PermissionsGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @RequirePermissions(['manage', 'member'])
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
@UseInterceptors(AuditLogInterceptor)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get('accept')
  @AuditLog({ action: 'invitation.accepted', entityType: 'Invitation', entityIdParam: 'token' })
  @ApiOperation({ summary: 'Accept an invitation using the token from email link' })
  async acceptInvitation(@Req() req: any, @Query('token') token: string) {
    return this.spacesService.acceptInvitation(token, req.user.userId);
  }
}