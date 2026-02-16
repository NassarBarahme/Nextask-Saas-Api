import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const user = config.get<string>('MAIL_USER') ?? '';
        const pass = (config.get<string>('MAIL_PASS') ?? '').replace(/\s/g, '');
        return {
          transport: {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: { user, pass },
          },
          defaults: {
            from: `"Nextask Support" <${user}>`,
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService, MailerModule],
})
export class MailModule {}
