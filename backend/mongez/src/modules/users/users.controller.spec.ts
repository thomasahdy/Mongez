import type { ExecutionContext, INestApplication } from '@nestjs/common';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import type { Mock } from 'jest-mock';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type UploadAvatarMock = Mock<UsersService['uploadAvatar']>;

describe('UsersController', () => {
  let app: INestApplication;
  let usersService: { uploadAvatar: UploadAvatarMock };

  beforeEach(async () => {
    usersService = {
      uploadAvatar: jest.fn<UsersService['uploadAvatar']>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<{ user?: { userId: string } }>();
          req.user = { userId: 'user-1' };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should pass multipart avatar file bytes to the service', async () => {
    const httpServer = app.getHttpServer() as Server;

    usersService.uploadAvatar.mockResolvedValue({
      id: 'user-1',
      avatarUrl: 'avatars/user-1/avatar.png',
    } as Awaited<ReturnType<UsersService['uploadAvatar']>>);

    await request(httpServer)
      .post('/users/me/avatar')
      .attach('file', Buffer.from('image-data'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(usersService.uploadAvatar).toHaveBeenCalledWith('user-1', {
      buffer: expect.any(Buffer),
      mimeType: 'image/png',
      originalName: 'avatar.png',
    });

    const [, file] = usersService.uploadAvatar.mock.calls[0];
    expect(file.buffer.toString()).toBe('image-data');
  });

  it('should reject avatar upload when no file is provided', async () => {
    const httpServer = app.getHttpServer() as Server;

    await request(httpServer).post('/users/me/avatar').expect(400);
    expect(usersService.uploadAvatar).not.toHaveBeenCalled();
  });
});
