/** Atomic across payment, order, and admin accounting replicas. Gaps are allowed. */
export async function allocateVoucherNumber(db: any, prefix: string): Promise<string> {
  const rows: Array<{ value: bigint }> = await db.$queryRaw`
    INSERT INTO "VoucherSequence" ("prefix", "value") VALUES (${prefix}, 1)
    ON CONFLICT ("prefix") DO UPDATE SET "value" = "VoucherSequence"."value" + 1
    RETURNING "value"`;
  if (!rows[0]) throw new Error('Voucher number allocation failed');
  return `${prefix}-${String(rows[0].value).padStart(4, '0')}`;
}
