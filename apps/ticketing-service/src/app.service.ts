import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  async getHello(): Promise<string> {
    const ticketCount = await this.prisma.ticket.count();
    return `Hello World! Tickets in database: ${ticketCount}`;
  }
}
