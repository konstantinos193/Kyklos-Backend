import { Controller, Post, Body } from '@nestjs/common';
import { ContactService } from './contact.service';
import { ContactFormDto } from './dto/contact-form.dto';

@Controller('api/contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async sendContact(@Body() body: ContactFormDto) {
    return this.contactService.sendContactForm(body);
  }
}

