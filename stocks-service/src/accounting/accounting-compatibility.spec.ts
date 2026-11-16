jest.mock('redis-service', () => ({ redis: {}, acquireProviderSlot: jest.fn() }));
import { AccountingService } from './accounting.service';
import { OrdersService } from '../orders/orders.service';

function prepareInventoryMocks(db: any) {
  db.$queryRaw ??= jest.fn().mockResolvedValue([]);
  db.inventoryShortfall ??= { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() };
  if (db.inventoryLot?.create) db.inventoryLot.create.mockImplementation(async ({ data }: any) => ({ id: 'new-lot', ...data }));
  if (db.stock) db.stock.updateMany ??= jest.fn().mockResolvedValue({ count: 1 });
}

describe('Existing accounting posting contracts', () => {
  it('keeps settlement net, charges and gross entries and UTR metadata unchanged', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      cashfreeSettlement: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'settlement-record' }), update: jest.fn() },
      voucher: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(async ({ data }) => ({ id: 'voucher', ...data })) },
    };
    db.$transaction = jest.fn(async callback => callback(db));
    prepareInventoryMocks(db);
    Object.assign(service, { prisma: db,
      getCashfreeLedger: jest.fn().mockResolvedValue({ id: 'cashfree' }),
      getPrimaryBankLedger: jest.fn().mockResolvedValue({ id: 'hdfc' }),
      getGatewayChargesLedger: jest.fn().mockResolvedValue({ id: 'charges' }),
      generateVoucherNumber: jest.fn().mockResolvedValue('RCP-0101'),
      postApprovedVoucherSideEffects: jest.fn(), recalculateAllBalances: jest.fn(),
    });
    const request = { settlementId: 'SETTLE-1', utrNumber: 'UTR-1', settlementDate: '2026-10-08', grossAmount: 1000, totalFee: 20, totalTax: 3.6, netAmount: 976.4 };
    await service.recordCashfreeSettlement(request);
    const posted = db.voucher.create.mock.calls[0][0].data;
    expect(posted.totalAmount).toBe(1000);
    expect(posted.referenceNumber).toBe('UTR-1');
    expect(posted.metadata).toEqual(expect.objectContaining({ voucherClass: 'BANK_SETTLEMENT', settlementId: 'SETTLE-1', utrNumber: 'UTR-1', grossAmount: 1000, netAmount: 976.4, fee: 20, tax: 3.6 }));
    expect(posted.entries.create).toEqual([
      expect.objectContaining({ ledgerId: 'hdfc', entryType: 'DEBIT', amount: 976.4 }),
      expect.objectContaining({ ledgerId: 'charges', entryType: 'DEBIT', amount: 23.6 }),
      expect.objectContaining({ ledgerId: 'cashfree', entryType: 'CREDIT', amount: 1000 }),
    ]);
    expect(service.postApprovedVoucherSideEffects).toHaveBeenCalledTimes(1);
    expect(service.recalculateAllBalances).toHaveBeenCalledTimes(1);
    db.cashfreeSettlement.findUnique.mockResolvedValue({ id: 'settlement-record' });
    await expect(service.recordCashfreeSettlement(request)).resolves.toEqual(expect.objectContaining({ alreadyExists: true }));
    expect(db.voucher.create).toHaveBeenCalledTimes(1);
  });

  it('keeps sales debit/credit amounts and balance increments unchanged', async () => {
    const service: any = Object.create(OrdersService.prototype);
    const db: any = { voucher: { create: jest.fn() }, ledger: { update: jest.fn() } };
    db.$transaction = jest.fn(async callback => callback(db));
    prepareInventoryMocks(db);
    Object.assign(service, { prisma: db, logger: { log: jest.fn() },
      getOrCreateSalesLedger: jest.fn().mockResolvedValue({ id: 'sales' }),
      findOrCreateUserLedger: jest.fn().mockResolvedValue({ id: 'customer' }),
      generateVoucherNumber: jest.fn().mockResolvedValue('SAL-0101'), generateReferenceNumber: jest.fn().mockResolvedValue('REF-1'),
    });
    await service.generateSalesVoucher({ id: 'order-1', user: {}, status: 'COMPLETED', totalAmount: 1000, quantity: 2, pricePerShare: 500, invoiceNumber: 'INV-1', shareTransferReferenceNo: 'TRANSFER-1', shareTransferDate: new Date('2026-10-08'), batchSequence: 'BATCH-1' });
    expect(db.voucher.create.mock.calls[0][0].data.entries.create).toEqual([
      expect.objectContaining({ ledgerId: 'customer', entryType: 'DEBIT', amount: 1000 }),
      expect.objectContaining({ ledgerId: 'sales', entryType: 'CREDIT', amount: 1000 }),
    ]);
    expect(db.ledger.update).toHaveBeenCalledWith({ where: { id: 'customer' }, data: { currentBalance: { increment: 1000 } } });
    expect(db.ledger.update).toHaveBeenCalledWith({ where: { id: 'sales' }, data: { currentBalance: { increment: -1000 } } });
  });

  it('keeps purchase voucher contract intact and creates inventory lot on approval', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      stock: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: { create: jest.fn() },
      ledger: { update: jest.fn() },
    };
    prepareInventoryMocks(db);
    Object.assign(service, { prisma: db });

    const voucher: any = {
      id: 'voucher-pur-1',
      voucherNumber: 'PUR-0001',
      type: 'RECEIPT',
      metadata: { voucherClass: 'PURCHASE' },
      date: new Date('2026-10-19'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'e1',
          ledgerId: 'stock-ledger-1',
          ledger: { id: 'stock-ledger-1', name: 'Stock in Hand - API', type: 'STOCK', stockId: 'stock-api-1' },
          entryType: 'DEBIT',
          amount: 8000,
          qty: 100,
          rate: 80,
          isin: 'INE0001',
        },
        {
          id: 'e2',
          ledgerId: 'seller-ledger-1',
          ledger: { id: 'seller-ledger-1', name: 'Seller Doe', type: 'USER' },
          entryType: 'CREDIT',
          amount: 8000,
        },
      ],
    };

    await service['postApprovedVoucherSideEffects'](db, voucher);

    expect(db.stock.update).toHaveBeenCalledWith({
      where: { id: 'stock-api-1' },
      data: { stockQuantity: { increment: 100 } },
    });
    expect(db.inventoryLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        voucherId: 'voucher-pur-1',
        originalQty: 100,
        remainingQty: 100,
        unitCost: 80,
        status: 'ACTIVE',
      }),
    });
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        voucherId: 'voucher-pur-1',
        qty: 100,
        rate: 80,
        type: 'PURCHASE',
      }),
    });
  });

  it('allows stock purchase via JOURNAL voucher and produces identical inventory lot and stock increments', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      stock: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: { create: jest.fn() },
      ledger: { update: jest.fn() },
    };
    prepareInventoryMocks(db);
    Object.assign(service, { prisma: db });

    const voucher: any = {
      id: 'voucher-jv-1',
      voucherNumber: 'JV-0001',
      type: 'JOURNAL',
      metadata: { voucherClass: 'JOURNAL' },
      date: new Date('2026-10-19'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'e1',
          ledgerId: 'stock-ledger-1',
          ledger: { id: 'stock-ledger-1', name: 'Stock in Hand - API', type: 'STOCK', stockId: 'stock-api-1' },
          entryType: 'DEBIT',
          amount: 8000,
          qty: 100,
          rate: 80,
          isin: 'INE0001',
        },
        {
          id: 'e2',
          ledgerId: 'seller-ledger-1',
          ledger: { id: 'seller-ledger-1', name: 'Seller Doe', type: 'USER' },
          entryType: 'CREDIT',
          amount: 8000,
        },
      ],
    };

    await service['postApprovedVoucherSideEffects'](db, voucher);

    // Verifies that JOURNAL voucher increments inventory just like a Purchase voucher
    expect(db.stock.update).toHaveBeenCalledWith({
      where: { id: 'stock-api-1' },
      data: { stockQuantity: { increment: 100 } },
    });
    expect(db.inventoryLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        voucherId: 'voucher-jv-1',
        originalQty: 100,
        remainingQty: 100,
        unitCost: 80,
        status: 'ACTIVE',
      }),
    });
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        voucherId: 'voucher-jv-1',
        qty: 100,
        rate: 80,
        type: 'PURCHASE',
      }),
    });
  });

  it('enforces Contra vouchers to only allow Bank and Cash ledgers', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      ledger: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'bank-1', name: 'HDFC Bank', type: 'BANK' },
          { id: 'user-1', name: 'Customer XYZ', type: 'USER' },
        ]),
      },
    };
    prepareInventoryMocks(db);
    Object.assign(service, {
      prisma: db,
      validateVoucherDate: jest.fn().mockResolvedValue(true),
    });

    const contraDto: any = {
      type: 'JOURNAL',
      date: '2026-10-19',
      narration: 'Transfer',
      metadata: { voucherClass: 'CONTRA' },
      entries: [
        { ledgerId: 'bank-1', entryType: 'DEBIT', amount: 5000 },
        { ledgerId: 'user-1', entryType: 'CREDIT', amount: 5000 },
      ],
    };

    await expect(service.createVoucher(contraDto, 'admin-1')).rejects.toThrow(
      /Contra vouchers only support Bank and Cash ledgers/
    );
  });

  it('keeps sales voucher FIFO allocation and COGS generation unchanged', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      stock: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'stock-api-1', name: 'API Holdings', stockQuantity: 100 }),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'lot-1', remainingQty: 50, unitCost: 80, stockId: 'stock-api-1' },
          { id: 'lot-2', remainingQty: 100, unitCost: 90, stockId: 'stock-api-1' },
        ]),
        update: jest.fn(),
      },
      inventoryLotAllocation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      voucher: {
        create: jest.fn().mockResolvedValue({ id: 'cogs-voucher-1' }),
      },
      ledger: {
        update: jest.fn(),
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          if (where?.code === 'COGS-EXP') return { id: 'cogs-ledger', name: 'Cost of Goods Sold', type: 'PURCHASE' };
          if (where?.code === 'STOCK-AGG') return { id: 'stock-agg-ledger', name: 'Stock in Hand Aggregate', type: 'STOCK' };
          return null;
        }),
      },
    };
    prepareInventoryMocks(db);
    Object.assign(service, {
      prisma: db,
      generateVoucherNumber: jest.fn().mockResolvedValue('JV-COGS-0001'),
      postApprovedVoucherSideEffects: jest.fn(),
    });

    const saleVoucher: any = {
      id: 'voucher-sal-1',
      voucherNumber: 'SAL-0001',
      type: 'PAYMENT_SALES',
      metadata: { voucherClass: 'SALE' },
      date: new Date('2026-10-19'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'e1',
          ledgerId: 'customer-ledger-1',
          ledger: { id: 'customer-ledger-1', name: 'Buyer John', type: 'USER' },
          entryType: 'DEBIT',
          amount: 7000,
        },
        {
          id: 'e2',
          ledgerId: 'stock-ledger-1',
          ledger: { id: 'stock-ledger-1', name: 'Stock in Hand - API', type: 'STOCK', stockId: 'stock-api-1' },
          entryType: 'CREDIT',
          amount: 7000,
          qty: 70,
          rate: 100,
          isin: 'INE0001',
        },
      ],
    };

    // Call actual method
    await AccountingService.prototype['postApprovedVoucherSideEffects'].call(service, db, saleVoucher);

    // 1. Stock quantity decremented by 70
    expect(db.stock.updateMany).toHaveBeenCalledWith({
      where: { id: 'stock-api-1', stockQuantity: 100, backupQuantity: 0 },
      data: { stockQuantity: { decrement: 70 } },
    });

    // 2. Inventory movement logged as SALE
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        voucherId: 'voucher-sal-1',
        qty: 70,
        rate: 100,
        type: 'SALE',
      }),
    });

    // 3. FIFO lots consumed: 50 from lot-1, 20 from lot-2
    expect(db.inventoryLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-1' },
      data: { remainingQty: 0, status: 'EXHAUSTED' },
    });
    expect(db.inventoryLot.update).toHaveBeenCalledWith({
      where: { id: 'lot-2' },
      data: { remainingQty: 80, status: 'ACTIVE' },
    });

    // 4. COGS: 50 * 80 (4000) + 20 * 90 (1800) = 5800
    expect(db.voucher.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        voucherNumber: 'JV-COGS-0001',
        totalAmount: 5800,
        type: 'JOURNAL',
      }),
      include: { entries: true },
    });
  });

  it('pure financial journal voucher does not touch stocks or inventory lots', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      stock: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: { create: jest.fn() },
      ledger: { update: jest.fn() },
    };
    prepareInventoryMocks(db);
    Object.assign(service, { prisma: db });

    const genericJv: any = {
      id: 'voucher-jv-fin',
      voucherNumber: 'JV-0002',
      type: 'JOURNAL',
      metadata: { voucherClass: 'JOURNAL' },
      date: new Date('2026-10-19'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'e1',
          ledgerId: 'exp-1',
          ledger: { id: 'exp-1', name: 'Office Expense', type: 'EXPENSE' },
          entryType: 'DEBIT',
          amount: 2500,
        },
        {
          id: 'e2',
          ledgerId: 'prov-1',
          ledger: { id: 'prov-1', name: 'Provision for Expenses', type: 'LIABILITY' },
          entryType: 'CREDIT',
          amount: 2500,
        },
      ],
    };

    await AccountingService.prototype['postApprovedVoucherSideEffects'].call(service, db, genericJv);

    // Should NOT touch stocks, lots, or movements
    expect(db.stock.update).not.toHaveBeenCalled();
    expect(db.inventoryLot.create).not.toHaveBeenCalled();
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
    // Running balances updated
    expect(db.ledger.update).toHaveBeenCalledWith({
      where: { id: 'exp-1' },
      data: { currentBalance: { increment: 2500 } },
    });
    expect(db.ledger.update).toHaveBeenCalledWith({
      where: { id: 'prov-1' },
      data: { currentBalance: { increment: -2500 } },
    });
  });

  it('validates Payment vouchers require funds disbursed from Bank or Cash', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      ledger: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-1', name: 'Vendor ABC', type: 'USER' },
          { id: 'user-2', name: 'Other Party', type: 'USER' },
        ]),
      },
    };
    prepareInventoryMocks(db);
    Object.assign(service, {
      prisma: db,
      validateVoucherDate: jest.fn().mockResolvedValue(true),
    });

    const paymentDto: any = {
      type: 'PAYMENT_SALES',
      date: '2026-10-19',
      narration: 'Vendor Payment',
      metadata: { voucherClass: 'PAYMENT' },
      entries: [
        { ledgerId: 'user-1', entryType: 'DEBIT', amount: 1000 },
        { ledgerId: 'user-2', entryType: 'CREDIT', amount: 1000 },
      ],
    };

    await expect(service.createVoucher(paymentDto, 'admin-1')).rejects.toThrow(
      /Payment vouchers require funds to be disbursed from a Bank or Cash ledger/
    );
  });

  it('validates Receipt vouchers require funds received into Bank, Cash, or Payment Gateway', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const db: any = {
      ledger: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-1', name: 'Customer XYZ', type: 'USER' },
          { id: 'user-2', name: 'Other Party', type: 'USER' },
        ]),
      },
    };
    prepareInventoryMocks(db);
    Object.assign(service, {
      prisma: db,
      validateVoucherDate: jest.fn().mockResolvedValue(true),
    });

    const receiptDto: any = {
      type: 'RECEIPT',
      date: '2026-10-19',
      narration: 'Customer Receipt',
      metadata: { voucherClass: 'RECEIPT' },
      entries: [
        { ledgerId: 'user-1', entryType: 'DEBIT', amount: 1000 },
        { ledgerId: 'user-2', entryType: 'CREDIT', amount: 1000 },
      ],
    };

    await expect(service.createVoucher(receiptDto, 'admin-1')).rejects.toThrow(
      /Receipt vouchers require funds to be received into a Bank, Cash, or Payment Gateway ledger/
    );
  });

  it('allows stock sale with 0 physical stock if backupQuantity covers it, resulting in negative stock, then cancels out on subsequent purchase', async () => {
    const service: any = Object.create(AccountingService.prototype);
    const stock = { id: 'stock-api-1', name: 'API Holdings Limited', stockQuantity: 0, backupQuantity: 100 };
    const shortfalls: any[] = [];
    const db: any = {
      stock: {
        findUnique: jest.fn(async () => ({ ...stock })),
        updateMany: jest.fn(async ({ where, data }) => {
          if (stock.stockQuantity !== where.stockQuantity || stock.backupQuantity !== where.backupQuantity) return { count: 0 };
          stock.stockQuantity -= data.stockQuantity.decrement;
          stock.backupQuantity -= data.backupQuantity?.decrement || 0;
          return { count: 1 };
        }),
        update: jest.fn(async ({ data }) => { stock.stockQuantity += data.stockQuantity.increment; return { ...stock }; }),
      },
      inventoryMovement: { create: jest.fn() },
      inventoryLot: {
        findMany: jest.fn().mockResolvedValue([]), // No physical lots currently
        create: jest.fn(),
        update: jest.fn(),
      },
      inventoryLotAllocation: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      inventoryShortfall: {
        create: jest.fn(async ({ data }) => { shortfalls.push({ id: 'shortfall-1', ...data }); }),
        findMany: jest.fn(async () => shortfalls.filter(s => s.remainingQty > 0)),
        update: jest.fn(async ({ data }) => { shortfalls[0].remainingQty -= data.remainingQty.decrement; }),
      },
      voucher: { create: jest.fn(async ({ data }) => ({ id: 'deferred-cogs', ...data, entries: data.entries.create })), update: jest.fn() },
      ledger: { update: jest.fn(), findFirst: jest.fn(async ({ where }) => ({ id: where.code })) },
    };
    prepareInventoryMocks(db);
    Object.assign(service, {
      prisma: db,
      generateVoucherNumber: jest.fn().mockResolvedValue('JV-COGS-0002'),
    });

    const saleVoucher: any = {
      id: 'voucher-sal-backup',
      voucherNumber: 'SAL-0099',
      type: 'PAYMENT_SALES',
      metadata: { voucherClass: 'SALE' },
      date: new Date('2026-10-19'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'e1',
          ledgerId: 'customer-1',
          ledger: { id: 'customer-1', name: 'Buyer A', type: 'USER' },
          entryType: 'DEBIT',
          amount: 4000,
        },
        {
          id: 'e2',
          ledgerId: 'stock-1',
          ledger: { id: 'stock-1', name: 'Stock in Hand - API', type: 'STOCK', stockId: 'stock-api-1' },
          entryType: 'CREDIT',
          amount: 4000,
          qty: 50,
          rate: 80,
          isin: 'INE0001',
        },
      ],
    };

    // 1. Process sale voucher when physical stock is 0 but backupQuantity is 100
    await AccountingService.prototype['postApprovedVoucherSideEffects'].call(service, db, saleVoucher);

    // Stock decremented by 50 (from 0 to -50)
    expect(stock).toMatchObject({ stockQuantity: -50, backupQuantity: 50 });
    expect(shortfalls[0].remainingQty).toBe(50);
    expect(db.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        qty: 50,
        type: 'SALE',
      }),
    });

    // 2. Later, Accountant records purchase of 100 shares via Purchase Voucher
    const purchaseVoucher: any = {
      id: 'voucher-pur-settle',
      voucherNumber: 'PUR-0100',
      type: 'RECEIPT',
      metadata: { voucherClass: 'PURCHASE' },
      date: new Date('2026-10-20'),
      createdById: 'admin-1',
      entries: [
        {
          id: 'p1',
          ledgerId: 'stock-1',
          ledger: { id: 'stock-1', name: 'Stock in Hand - API', type: 'STOCK', stockId: 'stock-api-1' },
          entryType: 'DEBIT',
          amount: 8000,
          qty: 100,
          rate: 80,
          isin: 'INE0001',
        },
        {
          id: 'p2',
          ledgerId: 'seller-1',
          ledger: { id: 'seller-1', name: 'Seller Doe', type: 'USER' },
          entryType: 'CREDIT',
          amount: 8000,
        },
      ],
    };

    await AccountingService.prototype['postApprovedVoucherSideEffects'].call(service, db, purchaseVoucher);

    // Stock incremented by +100 (canceling out the -50 to +50)
    expect(db.stock.update).toHaveBeenCalledWith({
      where: { id: 'stock-api-1' },
      data: { stockQuantity: { increment: 100 } },
    });
    expect(stock).toMatchObject({ stockQuantity: 50, backupQuantity: 50 });
    expect(shortfalls[0].remainingQty).toBe(0);
    expect(db.inventoryLot.update).toHaveBeenCalledWith({ where: { id: 'new-lot' }, data: { remainingQty: 50, status: 'ACTIVE' } });
    expect(db.inventoryLotAllocation.create).toHaveBeenCalledWith({ data: expect.objectContaining({ saleVoucherId: 'voucher-sal-backup', qtyConsumed: 50, cogsAmount: 4000 }) });
    expect(db.voucher.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalAmount: 4000, metadata: expect.objectContaining({ linkedSaleVoucherId: 'voucher-sal-backup' }) }) }));
    expect(db.ledger.update).toHaveBeenCalledWith({ where: { id: 'COGS-EXP' }, data: { currentBalance: { increment: 4000 } } });
    // Purchase lot created
    expect(db.inventoryLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stockId: 'stock-api-1',
        originalQty: 100,
        remainingQty: 100,
        unitCost: 80,
      }),
    });
  });
});

