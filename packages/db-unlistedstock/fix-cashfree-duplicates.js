const { PrismaClient } = require('./generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  
  // Find all old "Gross settlement deposit" receipts
  const oldGrossVouchers = await prisma.voucher.findMany({
    where: { 
      type: 'RECEIPT',
      narration: { startsWith: 'Bank Settlement transfer from Cashfree Gateway against UTR:' }
    },
    include: { entries: true }
  });

  const oldChargeVouchers = await prisma.voucher.findMany({
    where: { 
      type: 'PAYMENT_SALES',
      narration: { startsWith: 'Payment Gateway Charges & GST deducted by Cashfree for Settlement UTR:' }
    },
    include: { entries: true }
  });

  console.log(`Found ${oldGrossVouchers.length} gross vouchers and ${oldChargeVouchers.length} charge vouchers.`);

  const allVouchers = await prisma.voucher.findMany({
    where: {
      metadata: { path: ['voucherClass'], equals: 'BANK_SETTLEMENT' }
    },
    include: { entries: true }
  });

  console.log(`Found ${allVouchers.length} total BANK_SETTLEMENT vouchers.`);

  // Group by UTR
  const byUtr = {};
  for (const v of allVouchers) {
    if (!v.metadata || !v.metadata.utrNumber) continue;
    const utr = v.metadata.utrNumber;
    if (!byUtr[utr]) byUtr[utr] = [];
    byUtr[utr].push(v);
  }

  let deletedCount = 0;

  for (const [utr, list] of Object.entries(byUtr)) {
    if (list.length > 1) {
      console.log(`Duplicate found for UTR ${utr}: ${list.map(v => v.voucherNumber).join(', ')}`);
      
      // The old one has 2 entries (Bank DR, Cashfree CR).
      // The new one has 3 or 2 entries (Bank DR, Charges DR, Cashfree CR) and narration contains "Net:"
      const oldOne = list.find(v => !v.narration.includes('Net: ₹'));
      const newOne = list.find(v => v.narration.includes('Net: ₹'));

      if (oldOne && newOne) {
        console.log(`Deleting old duplicate voucher: ${oldOne.voucherNumber}`);
        
        await prisma.$transaction(async (tx) => {
          // Revert ledger balances for old one
          for (const entry of oldOne.entries) {
            await tx.ledger.update({
              where: { id: entry.ledgerId },
              data: {
                currentBalance: entry.entryType === 'DEBIT' ? { decrement: entry.amount } : { increment: entry.amount }
              }
            });
          }

          await tx.voucherEntry.deleteMany({ where: { voucherId: oldOne.id } });
          await tx.voucher.delete({ where: { id: oldOne.id } });

          // Also find and delete the associated old gateway charges voucher if it exists
          const oldCharge = await tx.voucher.findFirst({
            where: {
              type: 'PAYMENT_SALES',
              referenceNumber: `CHG-${utr}`
            },
            include: { entries: true }
          });

          if (oldCharge) {
            console.log(`Deleting old charge voucher: ${oldCharge.voucherNumber}`);
            for (const entry of oldCharge.entries) {
              await tx.ledger.update({
                where: { id: entry.ledgerId },
                data: {
                  currentBalance: entry.entryType === 'DEBIT' ? { decrement: entry.amount } : { increment: entry.amount }
                }
              });
            }
            await tx.voucherEntry.deleteMany({ where: { voucherId: oldCharge.id } });
            await tx.voucher.delete({ where: { id: oldCharge.id } });
          }
        });
        deletedCount++;
      }
    }
  }

  console.log(`Deleted ${deletedCount} duplicate voucher sets.`);
  await prisma.$disconnect();
}

main().catch(console.error);
