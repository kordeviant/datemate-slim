import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NodemailerService } from './nodemailer.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('NodemailerService', () => {
  let service: NodemailerService;
  let mockTransporter: { sendMail: jest.Mock };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize transporter with host and port (e.g. 587) when service is not set', async () => {
    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          SMTP_HOST: 'smtp.gmail.com',
          SMTP_PORT: '587',
          SMTP_USER: 'test@gmail.com',
          SMTP_PASS: 'password',
          SMTP_SECURE: 'false',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: 'test@gmail.com', pass: 'password' },
      }),
    );
  });

  it('should initialize transporter with service if SMTP_SERVICE is set', async () => {
    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          SMTP_SERVICE: 'gmail',
          SMTP_USER: 'test@gmail.com',
          SMTP_PASS: 'password',
        };
        return config[key] !== undefined ? config[key] : defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'gmail',
        auth: { user: 'test@gmail.com', pass: 'password' },
      }),
    );
  });

  it('should send verification OTP email', async () => {
    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);

    await service.sendVerificationOtp('user@example.com', '123456');

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'DateMate Verification Code',
        html: expect.stringContaining('123456'),
      }),
    );
  });

  it('should send password reset OTP email', async () => {
    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);

    await service.sendPasswordResetOtp('user@example.com', '654321');

    expect(mockTransporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'DateMate Password Reset Code',
        html: expect.stringContaining('654321'),
      }),
    );
  });

  it('should catch error gracefully if sendMail fails', async () => {
    mockTransporter.sendMail.mockRejectedValueOnce(new Error('Connection timeout'));

    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodemailerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<NodemailerService>(NodemailerService);

    await expect(
      service.sendVerificationOtp('user@example.com', '123456'),
    ).resolves.not.toThrow();
  });
});
