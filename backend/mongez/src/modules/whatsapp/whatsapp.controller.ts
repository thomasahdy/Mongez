import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  SpaceMemberGuard,
  SpaceRoles,
} from '../spaces/guards/space-member.guard';
import { ConfigService } from '@nestjs/config';
import { WhatsAppService } from './services/whatsapp.service';
import { WhatsAppOtpService } from './services/whatsapp-otp.service';
import { WhatsAppRepository } from './repositories/whatsapp.repository';
import { EncryptionService } from '../../shared/services/encryption.service';
import { MessagingCommandExecutor } from '../messaging/commands/messaging-command-executor.service';
import { SetupWhatsappDto } from './dto/setup-whatsapp.dto';
import { RegisterContactDto } from './dto/register-contact.dto';
import { RequestOtpDto, ConfirmOtpDto } from './dto/verify-phone.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly service: WhatsAppService,
    private readonly otpService: WhatsAppOtpService,
    private readonly repo: WhatsAppRepository,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly executor: MessagingCommandExecutor,
  ) {}

  // ── Meta webhook: GET verification ─────────────────────────────

  @Get('webhook')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    if (mode === 'subscribe' && this.service.verifyChallengeToken(token)) {
      this.logger.log('WhatsApp webhook verified.');
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    throw new UnauthorizedException('WhatsApp webhook verification failed');
  }

  // ── Meta webhook: POST inbound messages + statuses ─────────────

  @Post('webhook')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(
    @Req() req: Request,
    @Body() body: any,
    @Headers('x-hub-signature-256') signature: string,
  ) {
    const raw = (req as any).rawBody
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(body));
    if (!this.service.verifyWebhookSignature(raw, signature)) {
      this.logger.warn('WhatsApp webhook signature verification failed.');
      throw new UnauthorizedException('Invalid signature');
    }

    // Background-process to keep the webhook < 5s (Meta timeout).
    this.processInbound(body).catch((err) =>
      this.logger.error(
        `WhatsApp inbound processing failed: ${err?.message || err}`,
      ),
    );

    return { status: 'ok' };
  }

  private async processInbound(payload: any): Promise<void> {
    const entries: any[] = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        if (!value) continue;

        const spaceId = await this.resolveSpaceFromValue(value);
        if (!spaceId) continue;

        // 1. Status callbacks (delivery / read receipts)
        await this.processStatuses(value, spaceId);

        // 2. Inbound text commands
        await this.processMessages(value, spaceId);
      }
    }
  }

  private async resolveSpaceFromValue(value: any): Promise<string | null> {
    const phoneNumberId = value?.metadata?.phone_number_id;
    if (!phoneNumberId) return null;
    const account = await this.repo.findByPhoneNumberId(phoneNumberId);
    return account?.spaceId ?? null;
  }

  private async processStatuses(value: any, _spaceId: string): Promise<void> {
    const statuses: any[] = value?.statuses ?? [];
    for (const s of statuses) {
      if (!s?.id) continue;
      await this.repo.updateMessageByWaId(s.id, {
        status: (s.status || '').toUpperCase(),
        errorCode: s.errors?.code != null ? String(s.errors.code) : null,
      });
    }
  }

  private async processMessages(value: any, spaceId: string): Promise<void> {
    const messages: any[] = value?.messages ?? [];
    const fromPhoneRaw = messages[0]?.from;
    if (!messages.length || !fromPhoneRaw) return;

    const normalizedPhone = '+' + fromPhoneRaw.replace(/\D/g, '');
    const contact = await this.repo.findContactByPhone(
      normalizedPhone,
      spaceId,
    );
    if (!contact || !contact.isVerified) {
      this.logger.log(
        `Inbound WhatsApp from unverified/unknown contact ${normalizedPhone} (space ${spaceId}).`,
      );
      return;
    }

    for (const m of messages) {
      let text = '';
      let callbackPayload: string | undefined;

      if (m?.type === 'text') {
        text = m?.text?.body || '';
      } else if (m?.type === 'button') {
        callbackPayload = m?.button?.payload;
        text = m?.button?.text || '';
      } else if (m?.type === 'interactive' && m?.interactive?.type === 'button_reply') {
        callbackPayload = m?.interactive?.button_reply?.id;
        text = m?.interactive?.button_reply?.title || '';
      }

      if (!text && !callbackPayload) continue;

      // Record inbound message
      await this.repo.createMessage({
        spaceId,
        direction: 'INBOUND',
        fromPhone: normalizedPhone,
        toPhone: value?.metadata?.display_phone_number || '',
        content: text || callbackPayload || '',
        waMessageId: m.id ?? null,
        status: 'READ',
        metadata: { waId: m.from, callbackPayload },
      });

      if (contact.waId == null && m.from) {
        await this.repo.updateContactWaId(contact.id, m.from, true);
      }

      // Dispatch to the shared messaging command core
      const { reply } = await this.executor.handleInbound({
        channel: 'WHATSAPP',
        spaceId,
        userId: contact.userId,
        text,
        callbackPayload,
      });

      if (reply) {
        const account = await this.service.resolveAccount(spaceId);
        if (account)
          await this.service.sendText(account, normalizedPhone, reply);
      }
    }
  }

  // ── Admin / contact configuration (per-space) ──────────────────

  @Post('spaces/:spaceId/setup')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register WhatsApp Cloud API credentials for the space',
  })
  async setup(
    @Param('spaceId') spaceId: string,
    @Body() dto: SetupWhatsappDto,
  ) {
    const encryptedToken = this.encryption.encrypt(dto.accessToken);
    const account = await this.repo.upsertAccount(spaceId, {
      phoneNumberId: dto.phoneNumberId,
      wabaId: dto.wabaId,
      accessToken: encryptedToken,
      displayName: dto.displayName,
      webhookSecret: dto.webhookSecret,
      isActive: dto.isActive ?? true,
    });
    return {
      spaceId,
      phoneNumberId: account.phoneNumberId,
      displayName: account.displayName,
      isActive: account.isActive,
    };
  }

  @Get('spaces/:spaceId/status')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'WhatsApp integration status for the space + current user',
  })
  async status(@Param('spaceId') spaceId: string, @Req() req: any) {
    // resolveAccount checks DB first, then falls back to env vars
    const resolved = await this.service.resolveAccount(spaceId);
    const account = await this.repo.findActiveAccountBySpace(spaceId);
    const contact = await this.repo.findContact(req.user.userId, spaceId);
    return {
      configured: !!resolved,
      isActive: resolved ? (account?.isActive ?? true) : false,
      displayName: resolved?.displayName ?? null,
      phoneNumber: resolved?.phoneNumberId ?? null,
      source: resolved?.source ?? null,
      contact: contact
        ? {
            phoneNumber: contact.phoneNumber,
            optedIn: contact.optedIn,
            isVerified: contact.isVerified,
          }
        : null,
    };
  }

  @Post('spaces/:spaceId/contact')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Register / update the current user WhatsApp contact',
  })
  async registerContact(
    @Param('spaceId') spaceId: string,
    @Req() req: any,
    @Body() dto: RegisterContactDto,
  ) {
    const contact = await this.repo.upsertContact(req.user.userId, spaceId, {
      phoneNumber: dto.phoneNumber,
      waId: dto.waId,
    });
    return { contactId: contact.id, phoneNumber: contact.phoneNumber };
  }

  @Post('spaces/:spaceId/contact/opt-out')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Disable WhatsApp notifications for the current user',
  })
  async optOut(@Param('spaceId') spaceId: string, @Req() req: any) {
    const contact = await this.repo.findContact(req.user.userId, spaceId);
    if (!contact)
      throw new BadRequestException('No WhatsApp contact found for this user');
    const updated = await this.repo.upsertContact(req.user.userId, spaceId, {
      phoneNumber: contact.phoneNumber,
      waId: contact.waId,
      optedIn: false,
    });
    return { optedIn: updated.optedIn };
  }

  // ── OTP Verification endpoints ─────────────────────────────────

  @Post('spaces/:spaceId/otp/request')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Request an OTP code for WhatsApp phone verification',
  })
  async requestOtp(
    @Param('spaceId') spaceId: string,
    @Req() req: any,
    @Body() dto: RequestOtpDto,
  ) {
    await this.otpService.issueOtp(req.user.userId, spaceId, dto.phoneNumber);
    return { success: true, message: 'Verification code sent to WhatsApp.' };
  }

  @Post('spaces/:spaceId/otp/confirm')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Confirm OTP code and verify phone number',
  })
  async confirmOtp(
    @Param('spaceId') _spaceId: string,
    @Req() req: any,
    @Body() dto: ConfirmOtpDto,
  ) {
    await this.otpService.confirmOtp(req.user.userId, dto);
    return { success: true, message: 'Phone number verified successfully.' };
  }

  // ── Webhook registration helper ────────────────────────────────

  @Post('spaces/:spaceId/webhook/register')
  @UseGuards(JwtAuthGuard, SpaceMemberGuard)
  @SpaceRoles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Subscribe the Meta app to the webhook for this space',
  })
  async registerWebhook(@Param('spaceId') _spaceId: string) {
    // Meta webhook subscription is managed at the Meta App level. This endpoint
    // returns the public URL the admin should configure in the Meta dashboard.
    const base = this.config.get<string>('whatsapp.webhookPublicUrl') || '';
    const url = base
      ? `${base.replace(/\/$/, '')}/api/v1/whatsapp/webhook`
      : '';
    return {
      webhookUrl: url,
      note: 'Configure this URL in the Meta WhatsApp Manager.',
    };
  }
}
