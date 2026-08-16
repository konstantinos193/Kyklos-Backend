import { Module } from '@nestjs/common';
import { EpityxontesController } from './epityxontes.controller';
import { EpityxontesService } from './epityxontes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EpityxontesController],
  providers: [EpityxontesService],
  exports: [EpityxontesService],
})
export class EpityxontesModule {}
