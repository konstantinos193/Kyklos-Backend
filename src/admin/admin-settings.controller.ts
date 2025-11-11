import { Controller, Get, Put, UseGuards, Body, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AdminSettingsService } from './admin-settings.service';

@Controller('api/admin/settings')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  @Get()
  async getSettings() {
    try {
      const settings = await this.settingsService.getSettings();
      return {
        success: true,
        data: settings,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to fetch settings',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async updateSettings(@Body() body: any) {
    try {
      const updatedSettings = await this.settingsService.updateSettings(body);
      return {
        success: true,
        message: 'Settings updated successfully',
        data: updatedSettings,
      };
    } catch (error: any) {
      throw new HttpException(
        {
          success: false,
          message: error.message || 'Failed to update settings',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

