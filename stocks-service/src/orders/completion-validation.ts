import { BadRequestException } from '@nestjs/common';

export function assertCompletionTransfer(reference: string | null | undefined, date: Date | string | null | undefined, batch: string | null | undefined) {
  if (!reference?.trim() || !batch?.trim() || !date || !Number.isFinite(new Date(date).getTime())) {
    throw new BadRequestException('Completing an order requires a transfer reference number, a valid transfer date, and a batch number.');
  }
}
