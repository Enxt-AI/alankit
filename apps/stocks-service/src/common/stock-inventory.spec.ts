jest.mock('redis-service', () => ({ redis: {}, acquireProviderSlot: jest.fn() }));
import { reserveStock } from './stock-inventory';
import { OrdersService } from '../orders/orders.service';

function inventory(stockQuantity: number, backupQuantity: number) {
  const stock = { id: 'stock', name: 'Stock', stockQuantity, backupQuantity };
  const tx = { stock: {
    findUnique: jest.fn(async () => ({ ...stock })),
    updateMany: jest.fn(async ({ where, data }) => {
      if (where.stockQuantity !== stock.stockQuantity || where.backupQuantity !== stock.backupQuantity) return { count: 0 };
      stock.stockQuantity -= data.stockQuantity.decrement;
      stock.backupQuantity -= data.backupQuantity?.decrement || 0;
      return { count: 1 };
    }),
  } };
  return { stock, tx };
}

describe('Backup inventory reservations', () => {
  it('uses physical stock first and consumes only the backup remainder', async () => {
    const { stock, tx } = inventory(10, 50);
    expect(await reserveStock(tx, 'stock', 20)).toBe(10);
    expect(stock).toMatchObject({ stockQuantity: -10, backupQuantity: 40 });
    expect(await reserveStock(tx, 'stock', 40)).toBe(40);
    await expect(reserveStock(tx, 'stock', 1)).rejects.toThrow('Insufficient');
    expect(stock).toMatchObject({ stockQuantity: -50, backupQuantity: 0 });
  });

  it('rejects the stale reservation when two buyers read the same balances', async () => {
    const { stock, tx } = inventory(0, 100);
    const results = await Promise.allSettled([reserveStock(tx, 'stock', 60), reserveStock(tx, 'stock', 60)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(stock).toMatchObject({ stockQuantity: -60, backupQuantity: 40 });
  });

  it('restores each basket constituent backup once when its reservation expires', async () => {
    const service: any = Object.create(OrdersService.prototype);
    const order: any = {
      id: 'order', status: 'PENDING', paymentStatus: 'UNPAID', basketId: 'basket',
      pricePerShare: 100, quantity: 1,
      basketConstituents: { constituents: [
        { stockId: 'a', weight: 50, priceAtOrder: 10, backupQuantityUsed: 5 },
        { stockId: 'b', weight: 50, priceAtOrder: 10, backupQuantityUsed: 2 },
      ] },
    };
    const db: any = {
      stock: { update: jest.fn() },
      order: {
        findMany: jest.fn(async () => [order]),
        findUnique: jest.fn(async () => ({ ...order })),
        updateMany: jest.fn(async () => { order.status = 'EXPIRED'; return { count: 1 }; }),
        update: jest.fn(),
      },
    };
    db.$transaction = async (callback: any) => callback(db);
    Object.assign(service, { prisma: db, logger: { log: jest.fn(), error: jest.fn() } });
    await service.releaseExpiredInventory();
    await service.releaseExpiredInventory();
    expect(db.stock.update).toHaveBeenCalledTimes(2);
    expect(db.stock.update).toHaveBeenCalledWith({ where: { id: 'a' }, data: { stockQuantity: { increment: 5 }, backupQuantity: { increment: 5 } } });
    expect(db.stock.update).toHaveBeenCalledWith({ where: { id: 'b' }, data: { stockQuantity: { increment: 5 }, backupQuantity: { increment: 2 } } });
    expect(service.logger.error).not.toHaveBeenCalled();
  });
});
