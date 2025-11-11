import { Module } from '@nestjs/common';
import { PanhellenicArchiveController } from './panhellenic-archive.controller';
import { PanhellenicArchiveService } from './panhellenic-archive.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CloudinaryModule, AdminModule, AuthModule],
  controllers: [PanhellenicArchiveController],
  providers: [PanhellenicArchiveService],
  exports: [PanhellenicArchiveService],
})
export class PanhellenicArchiveModule {}

