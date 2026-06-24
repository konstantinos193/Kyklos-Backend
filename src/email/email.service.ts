import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASS');
    
    if (emailUser && emailPass) {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('EMAIL_HOST') || 'smtp.gmail.com',
        port: parseInt(this.configService.get<string>('EMAIL_PORT') || '587'),
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });
    } else {
      this.logger.warn('⚠️  Email credentials not configured - email features disabled');
      this.transporter = null;
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('⚠️  Email service not configured');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('✅ Email service ready');
      return true;
    } catch (error: any) {
      this.logger.error('❌ Email service error:', error.message);
      return false;
    }
  }

  // Newsletter methods moved to NewsletterService to avoid circular dependency
  // Use NewsletterController for newsletter operations

  async sendWelcomeEmail(email: string, name: string = '') {
    if (!this.transporter) {
      this.logger.warn('⚠️  Email service not configured - skipping welcome email');
      return;
    }

    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM') || 'grkyklos-@hotmail.gr',
        to: email,
        subject: '🎓 Καλώς ήρθατε στο ΚΥΚΛΟΣ Φροντιστήριο!',
        html: this.getWelcomeEmailTemplate(name, frontendUrl, email),
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Welcome email sent to ${email}`);
    } catch (error: any) {
      this.logger.error('Welcome email error:', error);
    }
  }

  async sendContactForm(data: {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
  }) {
    if (!this.transporter) {
      this.logger.warn('⚠️  Email service not configured - skipping contact form email');
      return { success: false, message: 'Email service not available' };
    }

    try {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM') || 'grkyklos-@hotmail.gr',
        to: this.configService.get<string>('CONTACT_EMAIL') || this.configService.get<string>('EMAIL_USER'),
        subject: `🌐 Νέο μήνυμα από την ιστοσελίδα: ${data.subject}`,
        html: this.getContactFormEmailTemplate(data, frontendUrl),
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Contact form email sent from ${data.email}`);
      return { success: true, message: 'Contact form submitted successfully' };
    } catch (error: any) {
      this.logger.error('Contact form email error:', error);
      return { success: false, message: 'Failed to send contact form' };
    }
  }

  private getWelcomeEmailTemplate(name: string, frontendUrl: string, email: string): string {
    return `
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Καλώς ήρθατε - ΚΥΚΛΟΣ Φροντιστήριο</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1f2937 50%, #E7B109 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: white;">Καλώς ήρθατε!</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">Στο ΚΥΚΛΟΣ Φροντιστήριο</p>
          </div>
          <div style="padding: 40px 30px;">
            <h2 style="color: #1e293b; margin: 0 0 15px 0;">Αγαπητέ/ή ${name || 'Φίλε/η'},</h2>
            <p style="color: #64748b; font-size: 16px; line-height: 1.6;">Ευχαριστούμε που εγγραφήκατε στο newsletter μας!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}" style="display: inline-block; background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px;">🌐 Επισκεφτείτε τον Ιστότοπό μας</a>
            </div>
            <div style="background: #f1f5f9; padding: 20px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">
                <a href="${frontendUrl}/unsubscribe?email=${email}" style="color: #CE3B49; font-weight: 600;">απεγγραφείτε εδώ</a>.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getContactFormEmailTemplate(
    data: { name: string; email: string; phone: string; subject: string; message: string },
    frontendUrl: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="el">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Νέο Μήνυμα - ΚΥΚΛΟΣ Φροντιστήριο</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1f2937 50%, #E7B109 100%); padding: 40px 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: white;">ΚΥΚΛΟΣ Φροντιστήριο</h1>
            <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">Νέο Μήνυμα Επικοινωνίας</p>
          </div>
          <div style="padding: 40px 30px;">
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <p><strong>Όνομα:</strong> ${data.name}</p>
              <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
              <p><strong>Τηλέφωνο:</strong> <a href="tel:${data.phone}">${data.phone}</a></p>
              <p><strong>Θέμα:</strong> ${data.subject}</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; border-radius: 12px;">
              <h3 style="margin-top: 0;">Μήνυμα:</h3>
              <p style="white-space: pre-wrap;">${data.message}</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="mailto:${data.email}?subject=Re: ${data.subject}" style="display: inline-block; background: linear-gradient(135deg, #CE3B49, #FF6B6B); color: white; padding: 16px 32px; text-decoration: none; border-radius: 12px;">📧 Απάντηση</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

