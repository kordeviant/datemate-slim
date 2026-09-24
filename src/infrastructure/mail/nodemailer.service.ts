import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IMailService } from './mail.service.interface';

@Injectable()
export class NodemailerService implements IMailService {
  private readonly logger = new Logger(NodemailerService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const service = this.configService.get<string>('SMTP_SERVICE', undefined);
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const portRaw = this.configService.get<string | number>('SMTP_PORT', 587);
    const port = Number(portRaw) || 587;
    const user = this.configService.get<string>('SMTP_USER', '');
    const pass = this.configService.get<string>('SMTP_PASS', '');
    const secureRaw = this.configService.get<string | boolean>(
      'SMTP_SECURE',
      false,
    );
    const secure = String(secureRaw) === 'true';

    const transportOptions = {
      family: 4, // Force IPv4 to prevent ENETUNREACH
      connectionTimeout: 5000, // 5s timeout to prevent Cloudflare 524
      greetingTimeout: 5000,
      socketTimeout: 5000,
      auth: user && pass ? { user, pass } : undefined,
    };

    if (service) {
      this.transporter = nodemailer.createTransport({
        ...transportOptions,
        service,
      } as any);
    } else {
      this.transporter = nodemailer.createTransport({
        ...transportOptions,
        host,
        port,
        secure,
      } as any);
    }
  }

  async sendVerificationOtp(email: string, code: string): Promise<void> {
    const from = this.configService.get<string>(
      'SMTP_FROM',
      '"DateMate Support" <no-reply@appdatemate.com>',
    );

    const mailOptions = {
      from,
      to: email,
      subject: 'DateMate Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
          <h2 style="color: #333; text-align: center;">Welcome to DateMate!</h2>
          <p style="font-size: 16px; color: #555;">Your verification code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #f3f3f3; padding: 10px 20px; border-radius: 6px; color: #111;">
              ${code}
            </span>
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}`, error);
      // We don't crash if SMTP is not configured in local dev, but log error
    }
  }

  async sendPasswordResetOtp(email: string, code: string): Promise<void> {
    const from = this.configService.get<string>(
      'SMTP_FROM',
      '"DateMate Support" <no-reply@appdatemate.com>',
    );

    const mailOptions = {
      from,
      to: email,
      subject: 'DateMate Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 8px;">
          <h2 style="color: #333; text-align: center;">DateMate Password Reset</h2>
          <p style="font-size: 16px; color: #555;">You requested to reset your password. Your reset code is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #f3f3f3; padding: 10px 20px; border-radius: 6px; color: #111;">
              ${code}
            </span>
          </div>
          <p style="font-size: 14px; color: #888; text-align: center;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}`, error);
    }
  }
}
