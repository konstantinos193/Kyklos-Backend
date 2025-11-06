import { Controller, Get, Put, UseGuards, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettingsController {
  @Get()
  async getSettings() {
    return {
      success: true,
      data: {
        // Placeholder - will be implemented based on admin-settings.js
      },
    };
  }

  @Put()
  async updateSettings(@Body() body: any) {
    return {
      success: true,
      message: 'Settings updated',
      data: body,
    };
  }
}

