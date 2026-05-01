import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BoardsService } from './boards.service';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Get(':id')
  async getBoard(@Param('id') id: string) {
    return this.boardsService.getBoardById(id);
  }

  @Get('department/:departmentId')
  async getDepartmentBoards(@Param('departmentId') departmentId: string) {
    return this.boardsService.getDepartmentBoards(departmentId);
  }

  @Post()
  async createBoard(@Body() body: any) {
    return this.boardsService.createBoard(body);
  }

  @Patch(':id')
  async updateBoard(@Param('id') id: string, @Body() body: any) {
    return this.boardsService.updateBoard(id, body);
  }

  @Delete(':id')
  async deleteBoard(@Param('id') id: string) {
    return this.boardsService.deleteBoard(id);
  }
}