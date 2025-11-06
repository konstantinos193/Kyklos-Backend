import { Controller, Get, Post, Body, Query, UseGuards, Inject, forwardRef } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { EmailService } from '../email/email.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletterService: NewsletterService,
    @Inject(forwardRef(() => EmailService))
    private readonly emailService: EmailService,
  ) {}

  @Post('subscribe')
  async subscribe(@Body() subscribeDto: SubscribeNewsletterDto) {
    return this.emailService.subscribeToNewsletter(
      subscribeDto.email,
      subscribeDto.name || '',
      subscribeDto.source || 'website',
    );
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() unsubscribeDto: UnsubscribeNewsletterDto) {
    return this.emailService.unsubscribeFromNewsletter(unsubscribeDto.email);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStats() {
    const activeCount = await this.newsletterService.count({ isActive: true });
    const totalCount = await this.newsletterService.count();
    return {
      success: true,
      data: {
        total: totalCount,
        active: activeCount,
        inactive: totalCount - activeCount,
      },
    };
  }

  @Get('subscribers')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSubscribers(@Query() query: any) {
    const { page = 1, limit = 50, status = 'active' } = query;
    const filter: any = {};
    if (status === 'active') filter.isActive = true;
    if (status === 'inactive') filter.isActive = false;
    
    const result = await this.newsletterService.find(filter, { page: parseInt(page), limit: parseInt(limit) });
    
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Post('send')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async sendNewsletter(@Body() sendDto: SendNewsletterDto) {
    // This would need to be implemented in EmailService or NewsletterService
    // For now, return a placeholder response
    return {
      success: false,
      message: 'Newsletter sending functionality needs to be implemented',
    };
  }

  @Get('export')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async exportSubscribers(@Query('format') format: string = 'json') {
    const subscribers = await this.newsletterService.find({ isActive: true }, { limit: 10000 });
    
    if (format === 'csv') {
      const csv = subscribers.data.map((s: any) => `${s.email},${s.name || ''}`).join('\n');
      return csv;
    }
    
    return {
      success: true,
      data: subscribers.data,
    };
  }

  @Get('verify')
  async verify() {
    const isReady = await this.emailService.verifyConnection();
    return {
      success: true,
      emailServiceReady: isReady,
    };
  }
}

