import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateSpaceDto } from '../spaces/dto/create-space.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString } from 'class-validator';

export class OnboardingSetupDto extends CreateSpaceDto {
  @IsString()
  templateId: string;
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('setup')
  async setup(@Req() req: any, @Body() dto: OnboardingSetupDto) {
    const userId = req.user.userId;
    const createSpaceDto: CreateSpaceDto = {
      name: dto.name,
      description: dto.description,
      icon: dto.icon,
      color: dto.color,
      prefix: dto.prefix,
    };
    return this.onboardingService.setupSpaceFromTemplate(userId, createSpaceDto, dto.templateId);
  }

  @Get('templates')
  async templates() {
    return this.onboardingService.getTemplates();
  }
}
