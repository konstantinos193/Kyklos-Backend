import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { UnsubscribeNewsletterDto } from './dto/unsubscribe-newsletter.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { NewsletterQueryDto } from './dto/newsletter-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('api/newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletterService: NewsletterService,
  ) {}

  @Post('subscribe')
  async subscribe(@Body() subscribeDto: SubscribeNewsletterDto) {
    try {
      const existing = await this.newsletterService.findByEmail(subscribeDto.email);

      if (existing) {
        if (existing.isActive) {
          return { success: false, message: 'Email already subscribed' };
        } else {
          await this.newsletterService.resubscribe(subscribeDto.email);
          return { success: true, message: 'Successfully resubscribed' };
        }
      }

      await this.newsletterService.create({
        email: subscribeDto.email,
        name: subscribeDto.name || '',
        source: subscribeDto.source || 'website',
        isActive: true,
        subscribedAt: new Date(),
      });

      return { success: true, message: 'Successfully subscribed' };
    } catch (error: any) {
      return { success: false, message: 'Subscription failed' };
    }
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() unsubscribeDto: UnsubscribeNewsletterDto) {
    try {
      const subscriber = await this.newsletterService.findByEmail(unsubscribeDto.email);
      if (!subscriber) {
        return { success: false, message: 'Email not found' };
      }

      await this.newsletterService.updateById(subscriber._id.toString(), {
        isActive: false,
        unsubscribedAt: new Date(),
      });

      return { success: true, message: 'Successfully unsubscribed' };
    } catch (error: any) {
      return { success: false, message: 'Unsubscription failed' };
    }
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
  async getSubscribers(@Query() query: NewsletterQueryDto) {
    const { page = 1, limit = 50, isActive } = query;
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive;

    const result = await this.newsletterService.find(filter, { page: page as any, limit: limit as any });

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
}

