import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      message: 'ΚΥΚΛΟΣ Φροντιστήριο API',
      version: '1.0.0',
      status: 'running',
    };
  }
}

