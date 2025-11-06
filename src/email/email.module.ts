import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NewsletterModule } from '../newsletter/newsletter.module';

@Module({
  imports: [NewsletterModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

