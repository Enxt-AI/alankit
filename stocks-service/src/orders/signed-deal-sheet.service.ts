import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';

// Never expose this bucket through the public storage service or set a public policy.
const BUCKET = 'signed-deal-sheets';

@Injectable()
export class SignedDealSheetService {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      endpoint: config.get('MINIO_ENDPOINT', 'http://localhost:9000'),
      region: 'ap-south-1',
      credentials: {
        accessKeyId: config.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: config.get('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private key(docId: string) {
    return `${createHash('sha256').update(docId).digest('hex')}.pdf`;
  }

  async read(docId: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: BUCKET, Key: this.key(docId) }));
      if (!result.Body) throw new Error('Stored deal sheet has no body');
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error: any) {
      if (['NoSuchKey', 'NoSuchBucket', 'NotFound'].includes(error.name)) return null;
      throw error;
    }
  }

  // model must come from the authenticated Digitap API, never a webhook body.
  async archive(docId: string, model: any): Promise<void> {
    if (!model?.signers?.length || !model.signers.every((s: any) => s.state === 'signed')) return;
    if (await this.read(docId)) return;
    if (model.docId && model.docId !== docId) throw new BadRequestException('Document ID mismatch');
    const url = new URL(model.url);
    const allowedHosts = this.config.get<string>('DIGITAP_DOCUMENT_HOSTS', 'esign-signed-docs-production.s3.ap-south-1.amazonaws.com').split(',').map(h => h.trim());
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !allowedHosts.includes(url.hostname)) {
      throw new BadRequestException('Unexpected signed document host');
    }
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error('Unable to retrieve signed deal sheet');
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response.body as any) {
      size += chunk.length;
      if (size > 25 * 1024 * 1024) throw new Error('Signed deal sheet exceeds 25 MB');
      chunks.push(Buffer.from(chunk));
    }
    const pdf = Buffer.concat(chunks);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Digitap did not return a PDF');
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: BUCKET }));
    } catch (error: any) {
      if (error.name !== 'BucketAlreadyOwnedByYou') throw error;
    }
    // Preserve the original bytes: regenerating the PDF would invalidate its signature.
    await this.client.send(new PutObjectCommand({
      Bucket: BUCKET, Key: this.key(docId), Body: pdf,
      ContentType: 'application/pdf',
      Metadata: { 'archived-at': new Date().toISOString() },
    }));
  }
}
