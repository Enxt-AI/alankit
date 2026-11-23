import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Queue } from 'bull';

/** Retain results and failures so HTTP retries cannot create another provider session. */
export const ESIGN_REQUEST_RETENTION_SECONDS = 24 * 60 * 60;

@Injectable()
export class EsignRequestsService {
  constructor(@InjectQueue('alankit-esign') private readonly queue: Queue) {}

  async generate(name: 'generate-session' | 'generate-order-esign', data: { userId: string; [key: string]: unknown }, requestId: string) {
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,128}$/.test(requestId)) {
      throw new BadRequestException('A valid x-idempotency-key is required for e-sign generation.');
    }
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    // Scope the key to the authenticated user, not a user ID supplied in the body.
    const jobId = `esign-${hash(JSON.stringify([data.userId, requestId]))}`;
    const fingerprint = hash(JSON.stringify([name, data]));
    let job;
    try {
      // Bull adds by jobId atomically in Redis. No check-then-add race across APIs.
      await this.queue.add(name, { ...data, requestFingerprint: fingerprint }, {
        jobId,
        attempts: 1,
        removeOnComplete: { age: ESIGN_REQUEST_RETENTION_SECONDS },
        removeOnFail: { age: ESIGN_REQUEST_RETENTION_SECONDS },
        // No Bull timeout: it rejects without cancelling the provider request.
      });
      // On duplicate add Bull returns the submitted data, not the stored data.
      job = await this.queue.getJob(jobId);
      if (!job) throw new Error('E-sign job unavailable');
    } catch {
      // Never bypass the shared queue when Redis is unavailable.
      throw new ServiceUnavailableException('E-sign is temporarily unavailable. Retry with the same request key.');
    }
    if (job.data.requestFingerprint !== fingerprint || job.name !== name) {
      throw new ConflictException('This e-sign request key was already used for a different purchase.');
    }
    try {
      return await job.finished();
    } catch {
      // A stalled-job detector can fail the job while its original worker is
      // finishing. Recover a durable result even if Bull's final ACK was lost.
      try {
        const saved = await this.queue.client.hget(this.queue.toKey(jobId), 'esignExecutionResult');
        if (saved) return JSON.parse(saved);
      } catch { /* Keep the same key when Redis or the saved result is unavailable. */ }
      throw new ServiceUnavailableException('E-sign could not be completed. Retry with the same request key; contact support if the failure persists.');
    }
  }
}
