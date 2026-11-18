jest.mock('redis-service', () => ({}));
// DTO sanitization is unrelated to worker/module lifecycle; its ESM dependency
// is not transformed by this service's CommonJS Jest configuration.
jest.mock('isomorphic-dompurify', () => ({ sanitize: jest.fn() }));
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { DigitapEsignProcessor } from './digitap-esign.processor';
import { OrdersService } from './orders.service';
import { OrdersModule } from './orders.module';
import { EsignWorkerModule } from '../esign-worker.module';

describe('E-sign worker lifecycle', () => {
  const makeQueue = () => ({ process: jest.fn().mockReturnValue(new Promise(() => {})), close: jest.fn().mockResolvedValue(undefined) });

  it('allows Nest initialization while the Bull consumer loop remains pending', async () => {
    const queue = makeQueue();
    const app = await Test.createTestingModule({
      providers: [DigitapEsignProcessor,
        { provide: getQueueToken('digitap-esign'), useValue: queue },
        { provide: OrdersService, useValue: {} },
        { provide: ConfigService, useValue: new ConfigService({}) },
      ],
    }).compile();
    await app.init();
    expect(queue.process).toHaveBeenCalledTimes(1);
    expect(queue.process).toHaveBeenCalledWith('*', 1, expect.any(Function));
    await app.close();
    expect(queue.close).toHaveBeenCalledTimes(1);
  }, 2000);

  it('registers the processor only in the worker and exports its queue dependency', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrdersModule)).not.toContain(DigitapEsignProcessor);
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, OrdersModule)).toContain(BullModule);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, EsignWorkerModule)
      .filter((provider: unknown) => provider === DigitapEsignProcessor)).toHaveLength(1);
  });

  it('accepts explicit concurrency and propagates synchronous registration failures', () => {
    const queue = makeQueue();
    const worker = new DigitapEsignProcessor(queue as any, {} as any, new ConfigService({ ESIGN_CONCURRENCY: '3' }));
    worker.onModuleInit();
    expect(queue.process).toHaveBeenCalledWith('*', 3, expect.any(Function));
    queue.process.mockImplementation(() => { throw new Error('Cannot define the same handler twice'); });
    expect(() => worker.onModuleInit()).toThrow('Cannot define the same handler twice');
  });

  it.each(['0', '-1', '1.5', 'abc', '33'])('rejects invalid concurrency %s before registration', value => {
    const queue = makeQueue();
    const worker = new DigitapEsignProcessor(queue as any, {} as any, new ConfigService({ ESIGN_CONCURRENCY: value }));
    expect(() => worker.onModuleInit()).toThrow('ESIGN_CONCURRENCY');
    expect(queue.process).not.toHaveBeenCalled();
  });

  it('handles consumer-loop rejection instead of leaving an unhandled promise', async () => {
    const queue = makeQueue();
    queue.process.mockReturnValue(Promise.reject(new Error('consumer failed')));
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    try {
      new DigitapEsignProcessor(queue as any, {} as any, new ConfigService({})).onModuleInit();
      await Promise.resolve();
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      exit.mockRestore();
    }
  });

  it('does not repeat generation when a stalled job is delivered to another worker', async () => {
    let claimed = false;
    const queue = {
      toKey: (id: string) => `bull:digitap-esign:${id}`,
      client: {
        eval: jest.fn(async () => { if (claimed) return 0; claimed = true; return 1; }),
        hget: jest.fn().mockResolvedValue(null), hset: jest.fn().mockResolvedValue(1),
      },
    };
    const orders = { processGenerateESignSession: jest.fn().mockResolvedValue({ docId: 'doc-1' }) };
    const workers = [0, 1].map(() => new DigitapEsignProcessor(queue as any, orders as any, new ConfigService({})));
    const job = { id: 'job-1', name: 'generate-session', timestamp: Date.now(), data: { userId: 'user-1', dto: {} } };
    const results = await Promise.allSettled(workers.map(worker => worker.process(job as any)));
    expect(orders.processGenerateESignSession).toHaveBeenCalledTimes(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(queue.client.hset).toHaveBeenCalledWith('bull:digitap-esign:job-1', 'esignExecutionResult', JSON.stringify({ docId: 'doc-1' }));
  });

  it('recovers a saved result after a crash before Bull completion acknowledgement', async () => {
    const queue = { toKey: jest.fn().mockReturnValue('job-key'), client: {
      eval: jest.fn().mockResolvedValue(0), hget: jest.fn().mockResolvedValue('{"docId":"saved-doc"}'),
    } };
    const orders = { processGenerateESign: jest.fn() };
    const worker = new DigitapEsignProcessor(queue as any, orders as any, new ConfigService({}));
    expect(await worker.process({ id: 'job-1', name: 'generate-order-esign', timestamp: Date.now(), data: {} } as any)).toEqual({ docId: 'saved-doc' });
    expect(orders.processGenerateESign).not.toHaveBeenCalled();
  });
});
