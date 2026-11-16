jest.mock('redis-service', () => ({ redis: {}, acquireProviderSlot: jest.fn() }));
import { AccountingService } from './accounting.service';
import { Prisma, deepDecryptSensitiveFields } from 'db-unlisted-stox';

describe('Deferred inventory costs', () => {
  it('preserves Decimal quantities through decryption when a receipt has no shortfalls', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db = {
      inventoryShortfall: { findMany: jest.fn().mockResolvedValue([]) },
      inventoryLot: { update: jest.fn() },
    };
    const lot = deepDecryptSensitiveFields({
      id: 'lot', stockId: 'stock',
      remainingQty: new Prisma.Decimal('1000'), unitCost: new Prisma.Decimal('73'),
    });
    expect(Number(lot.remainingQty)).toBe(1000);
    await service.settleInventoryShortfalls(db, lot, {});
    expect(db.inventoryLot.update).not.toHaveBeenCalled();
  });

  it('settles partial receipts FIFO at each receipt cost without changing stock twice', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const shortage = { id: 'shortage', saleVoucherId: 'sale', remainingQty: 50 };
    const db: any = {
      inventoryShortfall: {
        findMany: jest.fn(async () => shortage.remainingQty > 0 ? [{ ...shortage }] : []),
        update: jest.fn(async ({ data }) => { shortage.remainingQty -= data.remainingQty.decrement; }),
      },
      inventoryLot: { update: jest.fn() },
      inventoryLotAllocation: { create: jest.fn() },
      voucher: { create: jest.fn(async ({ data }) => ({ id: data.voucherNumber, ...data, entries: data.entries.create })) },
      ledger: { findFirst: jest.fn(async ({ where }) => ({ id: where.code })), update: jest.fn() },
      stock: { update: jest.fn(), updateMany: jest.fn() },
    };
    Object.assign(service, { prisma: db, generateVoucherNumber: jest.fn().mockResolvedValue('COGS') });
    const purchase = { id: 'purchase', createdById: 'admin', date: new Date('2026-10-19') };
    await service.settleInventoryShortfalls(db, deepDecryptSensitiveFields({ id: 'lot-1', stockId: 'stock', remainingQty: new Prisma.Decimal('20'), unitCost: new Prisma.Decimal('80') }), purchase);
    expect(shortage.remainingQty).toBe(30);
    expect(db.inventoryLot.update).toHaveBeenCalledWith({ where: { id: 'lot-1' }, data: { remainingQty: 0, status: 'EXHAUSTED' } });
    await service.settleInventoryShortfalls(db, deepDecryptSensitiveFields({ id: 'lot-2', stockId: 'stock', remainingQty: new Prisma.Decimal('40'), unitCost: new Prisma.Decimal('90') }), purchase);
    expect(shortage.remainingQty).toBe(0);
    expect(db.inventoryLot.update).toHaveBeenCalledWith({ where: { id: 'lot-2' }, data: { remainingQty: 10, status: 'ACTIVE' } });
    expect(db.inventoryLotAllocation.create.mock.calls.map(([arg]) => arg.data.cogsAmount)).toEqual([1600, 2700]);
    expect(db.stock.update).not.toHaveBeenCalled();
    expect(db.stock.updateMany).not.toHaveBeenCalled();
    expect(db.ledger.update).toHaveBeenCalledWith({ where: { id: 'COGS-EXP' }, data: { currentBalance: { increment: 2700 } } });
  });

  it('reverses an uncosted sale by closing the shortage and restoring its backup', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const original = { id: 'sale', type: 'PAYMENT_SALES', metadata: { voucherClass: 'SALE', backupQuantityUsed: { stock: 50 } }, entries: [] };
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      voucher: { findUnique: jest.fn().mockResolvedValue(original) },
      inventoryShortfall: { updateMany: jest.fn() },
      inventoryLotAllocation: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      stock: { update: jest.fn() },
      ledger: { update: jest.fn() },
    };
    Object.assign(service, { prisma: db });
    await service.postApprovedVoucherSideEffects(db, {
      id: 'reversal', type: 'PAYMENT_SALES', createdById: 'admin', date: new Date('2026-10-19'),
      metadata: { voucherClass: 'SALE', isReversal: true, reversedVoucherId: 'sale' },
      entries: [{ ledgerId: 'stock-ledger', ledger: { type: 'STOCK', stockId: 'stock' }, entryType: 'DEBIT', qty: 50, rate: 80, amount: 4000 }],
    });
    expect(db.inventoryShortfall.updateMany).toHaveBeenCalledWith({ where: { saleVoucherId: 'sale' }, data: { remainingQty: 0 } });
    expect(db.stock.update).toHaveBeenCalledWith({ where: { id: 'stock' }, data: { stockQuantity: { increment: 50 }, backupQuantity: { increment: 50 } } });
  });

  it('handles Journal voucher with stock and clearing ledgers by updating inventory solely via the inventory leg', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      voucher: { findUnique: jest.fn().mockResolvedValue({ id: 'jv-1', type: 'JOURNAL', entries: [] }) },
      inventoryLot: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      inventoryLotAllocation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      inventoryShortfall: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      stock: {
        findMany: jest.fn().mockResolvedValue([{ id: 'stock-msei' }]),
        findFirst: jest.fn().mockResolvedValue({ id: 'stock-msei' }),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      ledger: { update: jest.fn() },
    };
    Object.assign(service, { prisma: db });

    // Stock return (Debit to Unlisted Share Purchase PL436B, Credit to Inter DP SLDA08)
    await service.postApprovedVoucherSideEffects(db, {
      id: 'jv-rev',
      voucherNumber: 'JV-0004',
      type: 'JOURNAL',
      createdById: 'admin',
      date: new Date('2026-10-21'),
      totalAmount: 375883.4,
      metadata: { isReversal: true, reversedVoucherId: 'jv-1' },
      entries: [
        {
          ledgerId: 'inter-dp',
          ledger: { id: 'inter-dp', name: 'Inter DP Ledger Transfer (Retail Platform)', code: 'SLDA08', type: 'SALE' },
          entryType: 'CREDIT',
          qty: 55102,
          rate: 6.7,
          amount: 375883.4,
          isin: 'INE312K01010',
        },
        {
          ledgerId: 'unlisted-purchase',
          ledger: { id: 'unlisted-purchase', name: 'Unlisted Share Purchase', code: 'PL436B', type: 'PURCHASE' },
          entryType: 'DEBIT',
          qty: 55102,
          rate: 6.7,
          amount: 375883.4,
          isin: 'INE312K01010',
        },
      ],
    });

    // The clearing account (Inter DP) must be ignored, and only the stock asset leg (Debit) must increment stockQuantity
    expect(db.stock.update).toHaveBeenCalledWith({
      where: { id: 'stock-msei' },
      data: { stockQuantity: { increment: 55102 } },
    });
    expect(db.inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stockId: 'stock-msei',
          qty: 55102,
          type: 'PURCHASE',
          voucherId: 'jv-rev',
        }),
      })
    );
  });
});

