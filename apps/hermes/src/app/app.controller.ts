import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwksAuthGuard } from '@opareta/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @UseGuards(JwksAuthGuard)
  getData() {
    return this.appService.getData();
  }
}
