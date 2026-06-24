import { Module } from '@nestjs/common';
import { PanhellenicArchiveController } from './panhellenic-archive.controller';
import { PanhellenicArchiveService } from './panhellenic-archive.service';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [PanhellenicArchiveController],
  providers: [PanhellenicArchiveService],
  exports: [PanhellenicArchiveService],
})
export class PanhellenicArchiveModule {}

