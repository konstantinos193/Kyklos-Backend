import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

