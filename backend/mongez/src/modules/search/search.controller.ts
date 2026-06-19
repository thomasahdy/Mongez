import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchOptionsDto } from './dto/search-options.dto';

@ApiTags('Search')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  @ApiOperation({ summary: 'Unified global search across entities' })
  async globalSearch(@Req() req: any, @Query() options: SearchOptionsDto) {
    return this.searchService.globalSearch(req.user.userId, options);
  }

  @Get('search/suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions' })
  async suggestions(@Query('q') q: string, @Query('spaceId') spaceId: string) {
    return this.searchService.suggestions(q, spaceId);
  }

  @Get('search/filters')
  @ApiOperation({ summary: 'Available filter options for a space' })
  async getFilters(@Query('spaceId') spaceId: string) {
    return this.searchService.getFilters(spaceId);
  }
}