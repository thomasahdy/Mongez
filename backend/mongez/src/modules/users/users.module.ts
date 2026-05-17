import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRepository } from './repositories/user.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],   // provides PasswordService
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}