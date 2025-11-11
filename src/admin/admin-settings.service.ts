import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminSettingsService {
  private readonly COLLECTION_NAME = 'settings';
  private readonly SETTINGS_ID = 'app_settings'; // Single document ID for settings

  constructor(private readonly databaseService: DatabaseService) {}

  private getCollection() {
    return this.databaseService.getDb().collection(this.COLLECTION_NAME);
  }

  /**
   * Get all settings or return default settings if none exist
   */
  async getSettings() {
    const collection = this.getCollection();
    const settings = await collection.findOne({ _id: this.SETTINGS_ID });

    if (!settings) {
      // Return default settings if none exist
      return this.getDefaultSettings();
    }

    // Remove _id from response and return settings data
    const { _id, ...settingsData } = settings;
    return settingsData;
  }

  /**
   * Update settings (upsert - create if doesn't exist, update if exists)
   */
  async updateSettings(settingsData: any) {
    const collection = this.getCollection();
    
    // Merge with existing settings to preserve any fields not in the update
    const existingSettings = await this.getSettings();
    const mergedSettings = {
      ...existingSettings,
      ...settingsData,
      updatedAt: new Date(),
    };

    // Upsert settings document
    await collection.updateOne(
      { _id: this.SETTINGS_ID },
      {
        $set: mergedSettings,
        $setOnInsert: {
          _id: this.SETTINGS_ID,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return mergedSettings;
  }

  /**
   * Get default settings structure
   */
  private getDefaultSettings() {
    return {
      general: {
        siteName: 'ΚΥΚΛΟΣ Φροντιστήριο',
        siteDescription: 'Εκπαιδευτικό Κέντρο Αριστείας',
        siteUrl: 'https://kyklosedu.gr',
        adminEmail: 'grkyklos-@hotmail.gr',
        timezone: 'Europe/Athens',
        language: 'el',
      },
      email: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        smtpUser: 'grkyklos-@hotmail.gr',
        smtpSecure: false,
        fromName: 'ΚΥΚΛΟΣ Φροντιστήριο',
        fromEmail: 'grkyklos-@hotmail.gr',
      },
      security: {
        enableTwoFactor: false,
        sessionTimeout: '24',
        maxLoginAttempts: '5',
        passwordMinLength: '8',
        requireEmailVerification: true,
      },
      notifications: {
        emailNotifications: true,
        adminNotifications: true,
        userRegistration: true,
        newComment: true,
        newsletterSignup: true,
        systemAlerts: true,
      },
      database: {
        backupFrequency: 'daily',
        backupRetention: '30',
        enableLogging: true,
        logLevel: 'info',
        maxLogSize: '100',
      },
    };
  }
}

