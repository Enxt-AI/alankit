import { PrismaClient } from '../generated/prisma';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

import * as path from 'path';

async function main() {
  const filePath = path.join(__dirname, '..', 'CIN_unlistedzone_1y_prices.xlsx');
  
  console.log(`Reading Excel file from ${filePath}...`);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  
  // Read Summary to get notes
  const summarySheetName = workbook.SheetNames.find(n => n.toLowerCase() === 'summary');
  if (!summarySheetName) {
    throw new Error('Summary sheet not found in the Excel file.');
  }
  
  const summarySheet = workbook.Sheets[summarySheetName];
  const summaryData = XLSX.utils.sheet_to_json(summarySheet!) as any[];
  
  const cinToNotes = new Map<string, string>();
  for (const row of summaryData) {
    const cin = row['Source CIN'];
    const notes = row['Notes'];
    if (cin && notes) {
      cinToNotes.set(cin, String(notes).trim());
    }
  }

  let totalPricesAdded = 0;
  let skippedCompanies = 0;

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase() === 'summary') continue;

    console.log(`\nProcessing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    // Read as array of arrays to have consistent row/col access
    const data = XLSX.utils.sheet_to_json(sheet!, { header: 1 }) as any[][];

    // Find CIN
    let cin: string | undefined;
    for (let i = 0; i < 15; i++) {
      const row = data[i];
      if (row && row[0] === 'Source CIN') {
        cin = row[1];
      }
    }

    if (!cin) {
      console.log(`-> Skipping sheet ${sheetName}: No CIN found.`);
      skippedCompanies++;
      continue;
    }

    // Check if we should skip due to notes
    const notes = cinToNotes.get(cin);
    if (notes) {
      console.log(`-> Skipping CIN ${cin} (${sheetName}) due to notes: ${notes}`);
      skippedCompanies++;
      continue;
    }

    // Find stock
    const stock = await prisma.stock.findUnique({
      where: { cin }
    });

    if (!stock) {
      console.log(`-> Skipping sheet ${sheetName}: Stock not found in DB for CIN ${cin}.`);
      skippedCompanies++;
      continue;
    }

    // Find the row where Date and Price start
    let dataStartIndex = -1;
    for (let i = 0; i < 20; i++) {
      const row = data[i];
      if (row && row[0] === 'Date' && row[1] === 'Price') {
        dataStartIndex = i + 1;
        break;
      }
    }

    if (dataStartIndex === -1) {
      console.log(`-> Skipping sheet ${sheetName}: Could not find 'Date' and 'Price' columns.`);
      continue;
    }

    console.log(`-> Found stock ${stock.name} for CIN ${cin}. Adding prices...`);

    let addedCountForCompany = 0;
    // Iterate and add prices
    for (let i = dataStartIndex; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const dateVal = row[0];
      const priceVal = row[1];

      if (!dateVal || priceVal === undefined || priceVal === null || priceVal === '') continue;

      let date: Date;
      if (dateVal instanceof Date) {
        date = dateVal;
      } else if (typeof dateVal === 'string') {
        date = new Date(dateVal);
      } else if (typeof dateVal === 'number') {
        // Excel serial date fallback, but { cellDates: true } should handle it
        date = new Date((dateVal - (25567 + 2)) * 86400 * 1000);
      } else {
        continue;
      }

      const price = parseFloat(String(priceVal));

      if (!isNaN(date.getTime()) && !isNaN(price)) {
        await prisma.stockPrice.upsert({
          where: {
            stockId_date: {
              stockId: stock.id,
              date: date
            }
          },
          update: {}, // don't overwrite if exists
          create: {
            stockId: stock.id,
            date: date,
            price: price
          }
        });
        addedCountForCompany++;
      }
    }

    console.log(`-> Added ${addedCountForCompany} prices for ${stock.name}.`);
    totalPricesAdded += addedCountForCompany;
  }

  console.log(`\n================================`);
  console.log(`Finished seeding historical prices.`);
  console.log(`Total historic prices added: ${totalPricesAdded}`);
  console.log(`Total companies skipped: ${skippedCompanies}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
