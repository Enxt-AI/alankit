import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    // Supports standard CUIDs as well as human-readable ticket numbers (e.g. TKT-10001)
    const isCuid = /^c[a-z0-9]{19,29}$/i.test(value);
    const isTicketNumber = /^TKT-[0-9A-Za-z_-]+$/i.test(value);
    if (!isCuid && !isTicketNumber) {
      throw new BadRequestException('Validation failed (valid ID or Ticket Number expected)');
    }
    return value;
  }
}
