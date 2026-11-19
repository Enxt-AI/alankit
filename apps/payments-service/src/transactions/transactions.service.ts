import { Injectable } from '@nestjs/common';
import type { Prisma } from 'db-unlistedstock';
import { PrismaService } from '../prisma/prisma.service';

interface VoucherTransaction {
  id: string;
  source: 'voucher';
  voucherId: string;
  voucherNumber: string;
  voucherType: string;
  entryType: string;
  amount: number;
  narration: string;
  referenceNumber: string | null;
  scriptName: string | null;
  isin: string | null;
  qty: number | null;
  rate: number | null;
  date: Date;
  createdAt: Date;
  metadata: unknown;
  entryMetadata: unknown;
}

interface UserTransactionsResponse {
  orders: Prisma.OrderGetPayload<{
    include: { stock: true; basket: true };
  }>[];
  voucherTransactions: VoucherTransaction[];
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<UserTransactionsResponse> {
    // 1. Fetch orders (existing behaviour)
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        stock: true,
        basket: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Find the user's ledger (type = USER, userId = given userId)
    const userLedger = await this.prisma.ledger.findFirst({
      where: { userId, type: 'USER' },
    });

    let voucherTransactions: VoucherTransaction[] = [];

    if (userLedger) {
      // 3. Query VoucherEntry records linked to user's ledger
      //    where parent Voucher has status = APPROVED
      const voucherEntries = await this.prisma.voucherEntry.findMany({
        where: {
          ledgerId: userLedger.id,
          voucher: {
            status: 'APPROVED',
          },
        },
        include: {
          voucher: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const orderIds = new Set(orders.map((o) => o.id));
      const orderRefs = new Set(
        orders
          .flatMap((o: any) => [o.id, o.cashfreePaymentId, o.orderNumber])
          .filter(Boolean),
      );

      // Filter out vouchers tied to an existing buy order (e.g. receipt vouchers, sales delivery vouchers)
      // so orders are not duplicated in the user transactions view.
      const nonOrderEntries = voucherEntries.filter((entry) => {
        const meta = entry.voucher.metadata as any;
        if (meta?.orderId && orderIds.has(meta.orderId)) return false;
        if (entry.voucher.referenceNumber && orderRefs.has(entry.voucher.referenceNumber)) return false;
        if (entry.voucher.type === 'RECEIPT' && (meta?.orderId || meta?.type === 'receipt')) return false;
        return true;
      });

      // 4. Transform voucher entries into a unified transaction shape
      voucherTransactions = nonOrderEntries.map((entry) => ({
        // Common fields
        id: entry.id,
        source: 'voucher' as const,
        voucherId: entry.voucher.id,
        voucherNumber: entry.voucher.voucherNumber,
        voucherType: entry.voucher.type,

        // Amount: if user's ledger is CREDITED, it's money received by the user
        //         if user's ledger is DEBITED, it's money taken from the user
        entryType: entry.entryType,
        amount: entry.amount,

        // Details
        narration: entry.narration || entry.voucher.narration || '',
        referenceNumber: entry.voucher.referenceNumber,

        // Stock details (from VoucherEntry, if applicable)
        scriptName: entry.scriptName,
        isin: entry.isin,
        qty: entry.qty,
        rate: entry.rate,

        // Dates
        date: entry.voucher.date,
        createdAt: entry.createdAt,

        // Metadata from voucher
        metadata: entry.voucher.metadata,
        entryMetadata: entry.metadata,
      }));
    }

    // 5. Return both arrays so the frontend can distinguish and merge them
    return {
      orders,
      voucherTransactions,
    };
  }
}
