import { Global, Module } from '@nestjs/common';
import { MAIL_SERVICE } from './mail.service.interface';
import { NodemailerService } from './nodemailer.service';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_SERVICE,
      useClass: NodemailerService,
    },
  ],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
