import { EsignRequestsService, ESIGN_REQUEST_RETENTION_SECONDS } from './esign-requests.service';

describe('E-sign request deduplication', () => {
  const requestId = 'request-key-123456789';
  const data = { userId: 'user-1', dto: { stockId: 'stock-1', quantity: 1 } };
  let jobs: Map<string, any>;
  let queue: any;
  let service: EsignRequestsService;
  beforeEach(() => {
    jobs = new Map();
    queue = {
      add: jest.fn(async (name, payload, options) => {
        // Model Bull's atomic add-by-ID, including its duplicate return behavior.
        if (!jobs.has(options.jobId)) jobs.set(options.jobId, {
          name, data: payload, finished: jest.fn().mockResolvedValue({ docId: 'doc-1' }),
        });
        return { name, data: payload };
      }),
      getJob: jest.fn(async id => jobs.get(id)),
      toKey: (id: string) => `bull:alankit-esign:${id}`,
      client: { hget: jest.fn().mockResolvedValue(null) },
    };
    service = new EsignRequestsService(queue);
  });

  it('coalesces concurrent requests from separate API service instances', async () => {
    const secondApi = new EsignRequestsService(queue);
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? service : secondApi).generate('generate-session', data, requestId)));
    expect(jobs.size).toBe(1);
    expect(results.every(result => result.docId === 'doc-1')).toBe(true);
    expect(queue.add.mock.calls[0][2]).toEqual({
      jobId: expect.stringMatching(/^esign-[a-f0-9]{64}$/), attempts: 1,
      removeOnComplete: { age: ESIGN_REQUEST_RETENTION_SECONDS },
      removeOnFail: { age: ESIGN_REQUEST_RETENTION_SECONDS },
    });
  });

  it('replays a completed request with the same key', async () => {
    await service.generate('generate-session', data, requestId);
    expect(await service.generate('generate-session', data, requestId)).toEqual({ docId: 'doc-1' });
    expect(jobs.size).toBe(1);
  });

  it('does not expose another user result and allows a new logical purchase', async () => {
    await service.generate('generate-session', data, requestId);
    await service.generate('generate-session', { ...data, userId: 'user-2' }, requestId);
    await service.generate('generate-session', data, 'another-request-123456');
    expect(jobs.size).toBe(3);
  });

  it('rejects changed intent or endpoint with an already used key', async () => {
    await service.generate('generate-session', data, requestId);
    await expect(service.generate('generate-session', { ...data, dto: { stockId: 'stock-2', quantity: 2 } }, requestId)).rejects.toThrow('different purchase');
    await expect(service.generate('generate-order-esign', { userId: data.userId, orderId: 'order-1' }, requestId)).rejects.toThrow('different purchase');
    expect(jobs.size).toBe(1);
  });

  it('retains failures instead of removing and repeating provider creation', async () => {
    await service.generate('generate-session', data, requestId);
    const job = [...jobs.values()][0];
    job.finished.mockRejectedValue(new Error('Unknown provider outcome'));
    await expect(service.generate('generate-session', data, requestId)).rejects.toThrow('same request key');
    await expect(service.generate('generate-session', data, requestId)).rejects.toThrow('same request key');
    expect(jobs.size).toBe(1);
  });

  it('fails closed on Redis errors', async () => {
    queue.add.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.generate('generate-session', data, requestId)).rejects.toMatchObject({ status: 503 });
    expect(queue.getJob).not.toHaveBeenCalled();
  });

  it('recovers a durable result after a stalled job loses its completion acknowledgement', async () => {
    await service.generate('generate-session', data, requestId);
    [...jobs.values()][0].finished.mockRejectedValue(new Error('Missing job lock'));
    queue.client.hget.mockResolvedValue('{"docId":"recovered-doc"}');
    expect(await service.generate('generate-session', data, requestId)).toEqual({ docId: 'recovered-doc' });
    expect(jobs.size).toBe(1);
  });

  it.each([undefined, '', 'short', 'invalid:key:123456789', ['request-key-123456789']])('rejects invalid key %s before enqueue', async key => {
    await expect(service.generate('generate-session', data, key as any)).rejects.toMatchObject({ status: 400 });
    expect(queue.add).not.toHaveBeenCalled();
  });
});
