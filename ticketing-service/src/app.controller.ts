import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello(): Promise<string> {
    return this.appService.getHello();
  }

  // NOTE: Health endpoint is registered by HealthModule (health.controller.ts).
  // Removed duplicate @Get('health') that caused FST_ERR_DUPLICATED_ROUTE.
}
