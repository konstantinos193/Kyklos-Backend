import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { CacheModule } from '../cache/cache.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CacheModule, AuthModule],
  controllers: [NewsletterController],
  providers: [NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}

