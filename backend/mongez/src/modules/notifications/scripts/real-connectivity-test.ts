import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { WhatsAppService } from '../../whatsapp/services/whatsapp.service';
import { TelegramService } from '../../telegram/services/telegram.service';

async function bootstrap() {
  const phone = process.argv[2];
  const tgChatId = process.argv[3];

  if (!phone && !tgChatId) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: Please provide at least one destination.');
    console.log('Usage: npx ts-node src/modules/notifications/scripts/real-connectivity-test.ts <phone_number> <tg_chat_id>');
    console.log('Example: npx ts-node src/modules/notifications/scripts/real-connectivity-test.ts +1234567890 987654321');
    process.exit(1);
  }

  console.log('\x1b[34m%s\x1b[0m', '🚀 Bootstrapping NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const whatsappService = app.get(WhatsAppService);
  const telegramService = app.get(TelegramService);

  console.log('\x1b[34m%s\x1b[0m', '🔍 Resolving space configurations from environment fallback...');

  // 1. WhatsApp connectivity test
  if (phone) {
    console.log('\x1b[35m%s\x1b[0m', `📱 Attempting to send WhatsApp message to ${phone}...`);
    try {
      const account = await whatsappService.resolveAccount('test-space');
      if (!account) {
        console.error('\x1b[31m%s\x1b[0m', '❌ WhatsApp credentials not found in env configuration.');
      } else {
        console.log(`Using WhatsApp Phone ID: ${account.phoneNumberId}`);
        const result = await whatsappService.sendText(
          account,
          phone,
          'Hello from Mongez Platform Connectivity Test! 🚀',
        );

        if (result.status === 'SENT') {
          console.log('\x1b[32m%s\x1b[0m', `✅ WhatsApp message sent successfully! MsgId: ${result.waMessageId}`);
        } else {
          console.error('\x1b[31m%s\x1b[0m', `❌ WhatsApp send failed. ErrorCode: ${result.errorCode}`);
          console.log('Raw response:', result.raw);
        }
      }
    } catch (err: any) {
      console.error('\x1b[31m%s\x1b[0m', `❌ WhatsApp connectivity test failed: ${err.message}`);
    }
  }

  // 2. Telegram connectivity test
  if (tgChatId) {
    console.log('\x1b[35m%s\x1b[0m', `💬 Attempting to send Telegram message to ChatId: ${tgChatId}...`);
    try {
      const account = await telegramService.resolveAccount('test-space');
      if (!account) {
        console.error('\x1b[31m%s\x1b[0m', '❌ Telegram credentials not found in env configuration.');
      } else {
        console.log(`Using Telegram Bot Username: ${account.botUsername}`);
        const result = await telegramService.sendMessage(
          account.botToken,
          tgChatId,
          '<b>Hello from Mongez Platform Connectivity Test!</b> 🚀',
        );

        if (result.ok) {
          console.log('\x1b[32m%s\x1b[0m', `✅ Telegram message sent successfully! MsgId: ${result.tgMessageId}`);
        } else {
          console.error('\x1b[31m%s\x1b[0m', `❌ Telegram send failed. ErrorCode: ${result.errorCode}`);
          console.log('Raw response:', result.raw);
        }
      }
    } catch (err: any) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Telegram connectivity test failed: ${err.message}`);
    }
  }

  console.log('\x1b[34m%s\x1b[0m', '🔌 Shutting down NestJS context...');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
});
