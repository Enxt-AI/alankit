const path = require('path');
const fs = require('fs');

let PrismaClient;
try {
  PrismaClient = require('./generated/prisma').PrismaClient;
} catch (e1) {
  try {
    PrismaClient = require('@prisma/client').PrismaClient;
  } catch (e2) {
    // Neither available
  }
}

let Client;
try {
  Client = require('pg').Client;
} catch (e) {
  // pg module not available
}

function loadEnv(envPath) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = value.trim();
        }
      }
    });
  }
}

loadEnv(path.join(__dirname, '.env'));
loadEnv(path.join(__dirname, '../../.env'));

// Production Cashfree Configuration
const CLIENT_ID = process.env.CASHFREE_CLIENT_ID || '114341630bfc34d8a1bca52c8d76143411';
const CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET || 'cfsk_ma_prod_4321b3baa1f159606a7b3fcf845e0ab2_4483b5ea';
const ENV = 'PRODUCTION';
const BASE_URL = 'https://api.cashfree.com/pg';
const API_VERSION = '2025-01-01';

const DATABASE_URL = process.env.DATABASE_URL || '';

async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

async function fetchCashfreeOrder(cfOrderId) {
  const url = `${BASE_URL}/orders/${encodeURIComponent(cfOrderId)}`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'x-client-id': CLIENT_ID,
      'x-client-secret': CLIENT_SECRET,
      'x-api-version': API_VERSION,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404 || !response.ok) return null;
  return await response.json();
}

async function fetchCashfreePayments(cfOrderId) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET environment variables are required.');
  }

  const url = `${BASE_URL}/orders/${encodeURIComponent(cfOrderId)}/payments`;
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'x-client-id': CLIENT_ID,
      'x-client-secret': CLIENT_SECRET,
      'x-api-version': API_VERSION,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404 || !response.ok) return [];
  return await response.json();
}

async function fetchCashfreeOrderSettlement(cfOrderId) {
  const url = `${BASE_URL}/orders/${encodeURIComponent(cfOrderId)}/settlements`;
  try {
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'x-client-id': CLIENT_ID,
        'x-client-secret': CLIENT_SECRET,
        'x-api-version': API_VERSION,
        'Accept': 'application/json',
      },
    });

    if (response.status === 404 || !response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 Cashfree Sync: Orders, Payments, UTR & Settlements');
  console.log(`Environment: ${ENV}`);
  console.log(`Base URL:    ${BASE_URL}`);
  console.log(`API Version: ${API_VERSION}`);
  console.log('====================================================\n');

  let pgClient;
  let usePg = false;

  if (Client && DATABASE_URL) {
    try {
      pgClient = new Client({ connectionString: DATABASE_URL });
      await pgClient.connect();
      usePg = true;
    } catch (e) {
      usePg = false;
    }
  }

  let orders = [];
  let prismaClient;
  let attemptsByOrder = {};

  if (usePg) {
    const res = await pgClient.query(`
      SELECT "id", "orderNumber", "cashfreeOrderId", "cashfreePaymentId", "paymentStatus", "paymentData", "totalAmount", "createdAt"
      FROM "Order"
      ORDER BY "createdAt" ASC;
    `);
    orders = res.rows;

    try {
      const attemptsRes = await pgClient.query(`
        SELECT "orderId", "cashfreeOrderId" FROM "PaymentAttempt";
      `);
      for (const row of attemptsRes.rows) {
        if (!attemptsByOrder[row.orderId]) attemptsByOrder[row.orderId] = [];
        attemptsByOrder[row.orderId].push(row.cashfreeOrderId);
      }
    } catch (e) {}
  } else if (PrismaClient) {
    prismaClient = new PrismaClient();
    orders = await prismaClient.order.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        cashfreeOrderId: true,
        cashfreePaymentId: true,
        paymentStatus: true,
        paymentData: true,
        totalAmount: true,
        createdAt: true,
        paymentAttempts: {
          select: { cashfreeOrderId: true },
        },
      },
    });
  } else {
    console.error('❌ Could not load Prisma Client or pg driver.');
    console.error('👉 Please run: pnpm --filter db-unlisted-stox run generate');
    process.exit(1);
  }

  console.log(`📦 Found ${orders.length} total orders in database.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];

    let existingPaymentData = order.paymentData || {};
    if (typeof existingPaymentData === 'string') {
      try { existingPaymentData = JSON.parse(existingPaymentData); } catch (e) {}
    }

    const attempts = (usePg
      ? (attemptsByOrder[order.id] || [])
      : (order.paymentAttempts?.map((a) => a.cashfreeOrderId) || [])
    ).filter(Boolean);

    // Deep search inside existingPaymentData for any cf_order_id
    const deepCfOrderId =
      existingPaymentData.cf_order_id ||
      existingPaymentData.cfOrderId ||
      existingPaymentData.order?.cf_order_id ||
      existingPaymentData.data?.order?.cf_order_id ||
      existingPaymentData.payment?.cf_order_id ||
      existingPaymentData.paymentData?.cf_order_id ||
      existingPaymentData.cashfreeOrderId;

    const candidateIds = [
      order.orderNumber,
      existingPaymentData.order_id,
      deepCfOrderId,
      order.cashfreeOrderId && order.cashfreeOrderId !== order.orderNumber ? order.cashfreeOrderId : null,
      order.id,
      ...attempts,
    ].filter(Boolean);

    const uniqueCandidateIds = Array.from(new Set(candidateIds));
    console.log(`[${i + 1}/${orders.length}] Checking Order #${order.orderNumber || order.id}...`);

    let cfOrderData = null;
    let payments = [];
    let settlementData = null;

    // 1. Fetch Order Details from Cashfree
    for (const cfId of uniqueCandidateIds) {
      try {
        const fetchedOrder = await fetchCashfreeOrder(cfId);
        if (fetchedOrder && (fetchedOrder.cf_order_id || fetchedOrder.order_id)) {
          cfOrderData = fetchedOrder;
          break;
        }
      } catch (err) {}
    }

    // 2. Fetch Payments from Cashfree
    for (const cfId of uniqueCandidateIds) {
      try {
        const fetchedPayments = await fetchCashfreePayments(cfId);
        if (fetchedPayments && fetchedPayments.length > 0) {
          payments = fetchedPayments;
          break;
        }
      } catch (err) {}
    }

    // 3. Fetch Settlement Details & UTR from Cashfree
    for (const cfId of uniqueCandidateIds) {
      try {
        const fetchedSettle = await fetchCashfreeOrderSettlement(cfId);
        if (fetchedSettle) {
          settlementData = fetchedSettle;
          break;
        }
      } catch (err) {}
    }

    if (!cfOrderData && payments.length === 0 && !settlementData) {
      // Check if we can at least recover cashfreeOrderId from local paymentData or attempt
      const recoveredId =
        (deepCfOrderId && deepCfOrderId !== order.orderNumber ? String(deepCfOrderId) : null) ||
        (attempts.find((a) => /^\d+$/.test(a)) || null);

      if (recoveredId && (!order.cashfreeOrderId || order.cashfreeOrderId === order.orderNumber)) {
        console.log(`   ℹ️ Recovered cashfreeOrderId from local records: ${recoveredId}`);
        if (usePg) {
          await pgClient.query(`UPDATE "Order" SET "cashfreeOrderId" = $1 WHERE "id" = $2;`, [recoveredId, order.id]);
        } else {
          await prismaClient.order.update({ where: { id: order.id }, data: { cashfreeOrderId: recoveredId } });
        }
        updatedCount++;
        continue;
      }

      console.log(`   ⚠️ No Cashfree records found for Order #${order.orderNumber}`);
      notFoundCount++;
      continue;
    }

    // Determine IDs:
    const numericCfOrderId = cfOrderData?.cf_order_id ? cfOrderData.cf_order_id.toString() : 
                             (cfOrderData?.order_id && cfOrderData.order_id !== order.orderNumber ? cfOrderData.order_id.toString() : null);

    const successPayment = payments.find((p) => p.payment_status === 'SUCCESS');
    const primaryPayment = successPayment || payments[0] || {};

    const cfPaymentId = primaryPayment.cf_payment_id ? primaryPayment.cf_payment_id.toString() : 
                       (primaryPayment.payment_id ? primaryPayment.payment_id.toString() : null);

    const bankReference = primaryPayment.bank_reference || undefined;
    const paymentMethod = primaryPayment.payment_group || primaryPayment.payment_method || undefined;
    const paymentTime = primaryPayment.payment_completion_time || primaryPayment.payment_time || undefined;
    const paymentStatus = primaryPayment.payment_status || cfOrderData?.order_status;

    // Settlement fields
    const settlementUtr = settlementData?.transfer_utr || settlementData?.utr || primaryPayment.utr || undefined;
    const settlementId = settlementData?.cf_settlement_id?.toString() || settlementData?.settlement_id || undefined;
    const settlementDate = settlementData?.transfer_time || settlementData?.settlement_date || undefined;
    const serviceCharge = settlementData?.service_charge ?? settlementData?.fee ?? undefined;
    const serviceTax = settlementData?.service_tax ?? settlementData?.tax ?? undefined;

    const finalCashfreeOrderId =
      numericCfOrderId ||
      (deepCfOrderId && deepCfOrderId !== order.orderNumber ? String(deepCfOrderId) : null) ||
      (order.cashfreeOrderId && order.cashfreeOrderId !== order.orderNumber ? order.cashfreeOrderId : null) ||
      null;

    const finalCashfreePaymentId = cfPaymentId || order.cashfreePaymentId;

    const updatedPaymentData = {
      ...existingPaymentData,
      cf_order_id: finalCashfreeOrderId || existingPaymentData.cf_order_id,
      cf_payment_id: finalCashfreePaymentId || existingPaymentData.cf_payment_id,
      payment_id: finalCashfreePaymentId || existingPaymentData.payment_id,
      bank_reference: bankReference || existingPaymentData.bank_reference,
      payment_method: paymentMethod || existingPaymentData.payment_method,
      payment_time: paymentTime || existingPaymentData.payment_time,
      payment_status: paymentStatus || existingPaymentData.payment_status,
      // Settlement & UTR details:
      settlement_utr: settlementUtr || existingPaymentData.settlement_utr,
      transfer_utr: settlementUtr || existingPaymentData.transfer_utr,
      cf_settlement_id: settlementId || existingPaymentData.cf_settlement_id,
      settlement_id: settlementId || existingPaymentData.settlement_id,
      settlement_date: settlementDate || existingPaymentData.settlement_date,
      service_charge: serviceCharge !== undefined ? serviceCharge : existingPaymentData.service_charge,
      service_tax: serviceTax !== undefined ? serviceTax : existingPaymentData.service_tax,
      synced_at: new Date().toISOString(),
    };

    if (usePg) {
      await pgClient.query(
        `UPDATE "Order" SET "cashfreeOrderId" = COALESCE($1, "cashfreeOrderId"), "cashfreePaymentId" = COALESCE($2, "cashfreePaymentId"), "paymentData" = $3 WHERE "id" = $4;`,
        [finalCashfreeOrderId, finalCashfreePaymentId, JSON.stringify(updatedPaymentData), order.id]
      );
    } else {
      await prismaClient.order.update({
        where: { id: order.id },
        data: {
          ...(finalCashfreeOrderId && { cashfreeOrderId: finalCashfreeOrderId }),
          ...(finalCashfreePaymentId && { cashfreePaymentId: finalCashfreePaymentId }),
          paymentData: updatedPaymentData,
        },
      });
    }

    console.log(`   ✅ Synced! CF Order: ${finalCashfreeOrderId || 'N/A'}, Txn: ${finalCashfreePaymentId || 'N/A'}, UTR: ${settlementUtr || 'Pending'}, Fee: ₹${serviceCharge ?? '0'}`);
    updatedCount++;
  }

  console.log('\n====================================================');
  console.log('🎉 Migration Completed Successfully!');
  console.log(`Total Orders Processed: ${orders.length}`);
  console.log(`Updated:              ${updatedCount}`);
  console.log(`Not Found on CF:      ${notFoundCount}`);
  console.log('====================================================');

  if (usePg && pgClient) await pgClient.end();
  if (prismaClient) await prismaClient.$disconnect();
}

runMigration().catch(async (e) => {
  console.error('❌ Migration failed with error:', e);
  process.exit(1);
});
