import { PrismaClient } from '../generated/prisma';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const filePath = 'C:\\Users\\poras\\Downloads\\CIN_unlistedzone_1y_prices.xlsx';
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  let admin = await prisma.admin.findFirst();
  if (!admin) {
    admin = await prisma.admin.create({
      data: {
        email: 'testadmin@example.com',
        fullName: 'Test Admin',
        passwordHash: 'dummy'
      }
    });
    console.log('Created dummy admin');
  }

  let createdCount = 0;

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase() === 'summary') continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet!, { header: 1 }) as any[][];

    let cin: string | undefined;
    for (let i = 0; i < 15; i++) {
      const row = data[i];
      if (row && row[0] === 'Source CIN') {
        cin = row[1];
      }
    }

    if (!cin) continue;

    // Clean up sheet name for the stock name (e.g. "1_API HOLDINGS" -> "API HOLDINGS")
    const stockName = sheetName.replace(/^\d+_/, '');
    
    await prisma.stock.upsert({
      where: { cin },
      update: {},
      create: {
        cin,
        name: stockName,
        price: 100, // Dummy initial price
        createdById: admin.id
      }
    });
    console.log(`Upserted dummy stock: ${stockName} (${cin})`);
    createdCount++;
  }
  
  console.log(`\nFinished creating ${createdCount} dummy stocks.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
