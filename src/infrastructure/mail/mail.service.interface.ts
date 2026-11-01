export interface IMailService {
  sendVerificationOtp(email: string, code: string): Promise<void>;
  sendPasswordResetOtp(email: string, code: string): Promise<void>;
}

export const MAIL_SERVICE = Symbol('IMailService');
