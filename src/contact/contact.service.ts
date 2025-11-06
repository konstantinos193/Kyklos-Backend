import { Injectable, BadRequestException } from '@nestjs/common';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  constructor(private readonly emailService: EmailService) {}

  async sendContactForm(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) {
    // Verify email service is ready
    const isReady = await this.emailService.verifyConnection();
    if (!isReady) {
      throw new BadRequestException('Email service not available. Please try again later.');
    }

    // Send contact form email
    const result = await this.emailService.sendContactForm({
      name: data.name,
      email: data.email,
      phone: data.phone || 'Not provided',
      subject: data.subject,
      message: data.message,
    });

    if (result.success) {
      return {
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon!',
      };
    } else {
      throw new BadRequestException(result.message || 'Failed to send message. Please try again.');
    }
  }
}

