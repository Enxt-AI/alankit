import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PinoNestLogger } from '@smc/logger';

@Injectable()
export class BatchService {
  private readonly logger = new PinoNestLogger('stocks-service', 'BatchService');
  constructor(private prisma: PrismaService) { }

  async getAllRecords(startDate?: string, endDate?: string) {
    const whereClause: any = {
      status: 'PAID',
      paymentStatus: {
        not: 'PENDING',
      },
      user: {
        kycStatus: { not: 'PENDING' },
        dematStatus: { not: 'PENDING' },
        bankStatus: { not: 'PENDING' },
      },
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.createdAt.lte = end;
      }
    }

    // 1. Sync manually approved (COMPLETED with shareTransferReferenceNo) orders from the Order table
    const completedOrders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        stock: true,
        user: true,
      },
    });

    for (const order of completedOrders) {
      const txnId = order.cashfreePaymentId || order.cashfreeOrderId || order.shareTransferReferenceNo;
      if (!txnId) continue;

      const recordCount = await this.prisma.nsdlBatchRecord.count({
        where: { transactionId: txnId },
      });

      if (recordCount === 0) {
        // Parse user data for bank & demat
        let dpId = '';
        let clientId = '';
        if (order.user.dematData) {
          try {
            const parsed = typeof order.user.dematData === 'string'
              ? JSON.parse(order.user.dematData)
              : order.user.dematData;
            let rawAcc = (parsed.accountNumber || parsed.dematAccountNo || parsed.boId || '').toString().trim().toUpperCase();
            let rawDpId = (parsed.dpId || '').toString().trim().toUpperCase();
            let rawClientId = (parsed.clientId || '').toString().trim().toUpperCase();

            // Clean any quotes, leading dashes, internal hyphens and spaces
            rawAcc = rawAcc.replace(/^['"=]+|['"=]+$/g, '').replace(/^[-\s]+/, '').replace(/[-\s/]/g, '');
            rawDpId = rawDpId.replace(/^['"=]+|['"=]+$/g, '').replace(/^[-\s]+/, '').replace(/[-\s/]/g, '');
            rawClientId = rawClientId.replace(/^['"=]+|['"=]+$/g, '').replace(/^[-\s]+/, '').replace(/[-\s/]/g, '');

            let fullBoId = rawAcc;
            if (!fullBoId && rawDpId && rawClientId) {
              fullBoId = `${rawDpId}${rawClientId}`;
            }

            if (fullBoId && fullBoId.length === 16) {
              dpId = fullBoId.slice(0, 8);
              clientId = fullBoId.slice(8);
            } else if (rawDpId.length === 16) {
              dpId = rawDpId.slice(0, 8);
              clientId = rawDpId.slice(8);
            } else if (rawClientId.length === 16) {
              dpId = rawClientId.slice(0, 8);
              clientId = rawClientId.slice(8);
            } else if (rawDpId.length + rawClientId.length === 16) {
              const combined = `${rawDpId}${rawClientId}`;
              dpId = combined.slice(0, 8);
              clientId = combined.slice(8);
            } else {
              dpId = rawDpId;
              clientId = rawClientId;
            }

            if (clientId.length > 0 && clientId.length < 8 && /^\d+$/.test(clientId)) {
              clientId = clientId.padStart(8, '0');
            }
          } catch (e) { }
        }

        let bankName = '';
        let bankAccountNumber = '';
        if (order.user.bankData) {
          try {
            const parsed = typeof order.user.bankData === 'string'
              ? JSON.parse(order.user.bankData)
              : order.user.bankData;
            bankName = parsed.bankName || '';
            bankAccountNumber = parsed.accNo || '';
          } catch (e) { }
        } else if (order.user.kycData) {
          // Fallback to old kycData structure just in case
          try {
            const parsed = typeof order.user.kycData === 'string'
              ? JSON.parse(order.user.kycData)
              : order.user.kycData;
            if (parsed.bankDetails) {
              bankName = parsed.bankDetails.bankName || bankName;
              bankAccountNumber = parsed.bankDetails.accountNumber || bankAccountNumber;
            }
          } catch (e) { }
        }

        const dateOfPayment = order.createdAt.toLocaleDateString('en-GB');
        const executionDate = order.shareTransferDate
          ? order.shareTransferDate.toLocaleDateString('en-GB')
          : '';
        const transfereeName = order.user.fullName || '';

        if (order.stock) {
          await this.prisma.nsdlBatchRecord.create({
            data: {
              isin: order.stock.isin || order.stock.cin || '',
              quantity: order.quantity,
              dpId,
              clientId,
              considerationAmount: order.totalAmount,
              executionDate,
              dateOfPayment,
              modeOfPayment: '03',
              transfereeName,
              bankName,
              bankAccountNumber,
              transactionId: txnId,
            },
          });
        } else if (order.basketConstituents) {
          const constituents = typeof order.basketConstituents === 'string'
            ? JSON.parse(order.basketConstituents)
            : order.basketConstituents;

          for (const constituent of constituents.constituents || []) {
            const constituentValue = order.pricePerShare * order.quantity * (constituent.weight / 100);
            const constituentQuantity = Math.round(constituentValue / constituent.priceAtOrder);

            await this.prisma.nsdlBatchRecord.create({
              data: {
                isin: constituent.stockCin || '',
                quantity: constituentQuantity,
                dpId,
                clientId,
                considerationAmount: constituentValue,
                executionDate,
                dateOfPayment,
                modeOfPayment: '03',
                transfereeName,
                bankName,
                bankAccountNumber,
                transactionId: txnId,
              },
            });
          }
        }
      }
    }

    // 2. Return all records mapping to the new specific fields
    const validTxnIds = new Set(
      completedOrders.map(o => o.cashfreePaymentId || o.cashfreeOrderId || o.shareTransferReferenceNo).filter(Boolean)
    );

    const allRecords = await this.prisma.nsdlBatchRecord.findMany({
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Only return records for orders that are CURRENTLY approved/completed, ensuring 8-char DP ID and 8-digit Client ID
    return allRecords.filter(record =>
      record.transactionId && validTxnIds.has(record.transactionId)
    ).map(record => {
      let dpId = (record.dpId || '').toString().replace(/^['"=]+|['"=]+$/g, '').replace(/^[-\s]+/, '').replace(/[-\s/]/g, '').trim().toUpperCase();
      let clientId = (record.clientId || '').toString().replace(/^['"=]+|['"=]+$/g, '').replace(/^[-\s]+/, '').replace(/[-\s/]/g, '').trim();

      if (dpId.length === 16 && (!clientId || clientId === '0' || clientId === '00' || clientId === '000')) {
        clientId = dpId.slice(8);
        dpId = dpId.slice(0, 8);
      } else if (clientId.length === 16 && (!dpId || dpId === '0' || dpId === '00')) {
        dpId = clientId.slice(0, 8).toUpperCase();
        clientId = clientId.slice(8);
      } else if (dpId.length + clientId.length === 16 && dpId.length !== 8) {
        const combined = dpId + clientId;
        dpId = combined.slice(0, 8);
        clientId = combined.slice(8);
      }

      if (clientId.length > 0 && clientId.length < 8 && /^\d+$/.test(clientId)) {
        clientId = clientId.padStart(8, '0');
      }
      return { ...record, dpId, clientId };
    });
  }

  async markRecordsAsGenerated(ids: string[], batchNumber?: number) {
    return this.prisma.$transaction(async (tx) => {
      let currentSeq: number | undefined;

      if (batchNumber !== undefined) {
        currentSeq = batchNumber;
      } else {
        const maxRecord = await tx.nsdlBatchRecord.findFirst({
          where: { batchSequence: { not: null } },
          orderBy: { batchSequence: 'desc' },
        });
        currentSeq = Math.max(maxRecord?.batchSequence || 0, 999);
      }

      const results: string[] = [];
      for (const id of ids) {
        const existing = await tx.nsdlBatchRecord.findUnique({ where: { id } });
        if (existing && !existing.isBatchGenerated) {
          if (batchNumber === undefined) {
            currentSeq++;
          }
          await tx.nsdlBatchRecord.update({
            where: { id },
            data: {
              isBatchGenerated: true,
              batchSequence: currentSeq,
            },
          });
          results.push(id);
        }
      }

      // Automatically increment and persist the batch sequence in the local JSON config file
      if (batchNumber !== undefined) {
        const nextSeq = String(batchNumber + 1);
        try {
          const fs = require('fs');
          const path = require('path');
          const configPath = path.join(process.cwd(), 'nsdl_batch_config.json');
          let currentConfig = { batchNumber: '1000080', dpId: '', clientId: '' };
          if (fs.existsSync(configPath)) {
            currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          }
          currentConfig.batchNumber = nextSeq;
          fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), 'utf8');
        } catch (e) {
          this.logger.error({ err: e }, 'Failed to auto-increment batch sequence file config:');
        }
      }

      return { success: true, count: results.length };
    });
  }

  async getBatchConfig() {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'nsdl_batch_config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return {
          batchNumber: config.batchNumber || '1000080',
          dpId: config.dpId || '',
          clientId: config.clientId || '',
        };
      }
    } catch (e) {
      this.logger.error({ err: e }, 'Failed to read batch configuration file:');
    }

    return {
      batchNumber: '1000080',
      dpId: '',
      clientId: '',
    };
  }

  async updateBatchConfig(dto: { batchNumber: string; dpId: string; clientId: string }) {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(process.cwd(), 'nsdl_batch_config.json');
      fs.writeFileSync(configPath, JSON.stringify(dto, null, 2), 'utf8');
      return { success: true };
    } catch (e) {
      this.logger.error({ err: e }, 'Failed to write batch configuration file:');
      throw new Error('Failed to update configuration on server.');
    }
  }
}
