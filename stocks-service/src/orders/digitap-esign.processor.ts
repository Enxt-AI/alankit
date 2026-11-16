import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit, BeforeApplicationShutdown } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import type { Job, Queue } from 'bull';
import { OrdersService } from './orders.service';
import { positiveInteger } from './esign.config';

/** Registered only by EsignWorkerModule. One dispatcher gives a real per-worker cap. */
@Injectable()
export class DigitapEsignProcessor implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new PinoNestLogger('stocks-service', 'DigitapEsignProcessor');

  constructor(
    @InjectQueue('digitap-esign') private readonly queue: Queue,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const concurrency = positiveInteger(this.config, 'ESIGN_CONCURRENCY', 1, 32);
    // Bull returns the lifetime of its consumer loop, not a startup promise.
    // Synchronous registration errors still propagate to Nest bootstrap.
    void this.queue.process('*', concurrency, job => this.process(job)).catch(error => {
      this.logger.error('E-sign consumer stopped unexpectedly', error);
      process.exit(1); // Let the process supervisor restart a failed consumer.
    });
    this.logger.log(`E-sign consumer registered; concurrency=${concurrency}`);
  }

  async beforeApplicationShutdown() {
    // Drain active jobs before dependencies close.
    await this.queue.close();
  }

  async process(job: Job) {
    const started = Date.now();
    try {
      switch (job.name) {
        case 'generate-session':
          return await this.generateOnce(job, () => this.ordersService.processGenerateESignSession(job.data.userId, job.data.dto));
        case 'generate-order-esign':
          return await this.generateOnce(job, () => this.ordersService.processGenerateESign(job.data.orderId, job.data.userId));
        case 'archive-signed-document': {
          const model = await this.ordersService.getESignDoc(job.data.docId);
          if (!model?.signers?.length || !model.signers.every((s: any) => s.state === 'signed')) {
            throw new Error('Signed document is not ready; retrying');
          }
          return;
        }
        default:
          throw new Error(`Unknown e-sign job: ${job.name}`);
      }
    } finally {
      this.logger.log(`job=${job.id} type=${job.name} waitMs=${started - job.timestamp} durationMs=${Date.now() - started} rssMb=${Math.ceil(process.memoryUsage().rss / 1048576)}`);
    }
  }

  private async generateOnce(job: Job, generate: () => Promise<unknown>) {
    const key = this.queue.toKey(String(job.id));
    // A stalled job can be delivered again even with attempts: 1. Claim before
    // any provider side effect and never blindly repeat an ambiguous POST.
    const claim = await this.queue.client.eval(`
      if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
      return redis.call('HSETNX', KEYS[1], 'esignExecutionStarted', '1')
    `, 1, key);
    if (claim !== 1) {
      const saved = await this.queue.client.hget(key, 'esignExecutionResult');
      if (saved) return JSON.parse(saved);
      throw new Error('E-sign execution already started; provider outcome requires reconciliation.');
    }
    const result = await generate();
    // If the process dies before Bull acknowledges completion, replay this
    // result on redelivery without creating a second Digitap document.
    await this.queue.client.hset(key, 'esignExecutionResult', JSON.stringify(result));
    return result;
  }
}
