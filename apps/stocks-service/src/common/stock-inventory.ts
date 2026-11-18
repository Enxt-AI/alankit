import { BadRequestException, NotFoundException } from '@nestjs/common';

/** Must run inside the caller's transaction. Backup is remaining sellable allowance. */
export async function reserveStock(tx: any, stockId: string, quantity: number): Promise<number> {
  const stock = await tx.stock.findUnique({ where: { id: stockId } });
  if (!stock) throw new NotFoundException(`Stock with ID ${stockId} not found`);
  const physical = Math.max(0, stock.stockQuantity);
  const backup = stock.backupQuantity ?? 0;
  if (physical + backup < quantity) {
    throw new BadRequestException(`Insufficient stock quantity for "${stock.name}". Available: ${physical + backup}, requested: ${quantity}.`);
  }
  const backupUsed = Math.max(0, quantity - physical);
  // Compare both balances, so concurrent reservations or operations edits cannot
  // apply a deduction calculated from an outdated split of physical and backup.
  const result = await tx.stock.updateMany({
    where: { id: stockId, stockQuantity: stock.stockQuantity, backupQuantity: backup },
    data: {
      stockQuantity: { decrement: quantity },
      ...(backupUsed > 0 ? { backupQuantity: { decrement: backupUsed } } : {}),
    },
  });
  if (!result.count) throw new BadRequestException('Stock availability changed. Please retry.');
  return backupUsed;
}
