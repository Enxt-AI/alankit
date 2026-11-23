import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, PutObjectCommand, CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Never expose this bucket through the public storage service or set a public policy.
const BUCKET = 'signed-deal-sheets';
const SOURCE_BUCKET = 'alankit-esign-source-documents';
const SOURCE_DOCUMENT_TTL_SECONDS = 6 * 60 * 60;
const SOURCE_DOCUMENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PDF_SIZE = 25 * 1024 * 1024;

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

  private createClient(endpoint: string) {
    return new S3Client({
      endpoint,
      region: 'ap-south-1',
      credentials: {
        accessKeyId: this.config.get('MINIO_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.config.get('MINIO_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private async ensureBucket(bucket: string) {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error: any) {
      if (!['NotFound', 'NoSuchBucket'].includes(error.name) && error.$metadata?.httpStatusCode !== 404) throw error;
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch (createError: any) {
        if (!['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(createError.name)) throw createError;
      }
    }
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

  async createAlankitSourcePdf(pdf: Buffer): Promise<{ sourceUrl: string; objectKey: string }> {
    this.assertPdf(pdf);
    const publicEndpoint = this.config.getOrThrow<string>('ALANKIT_ESIGN_PUBLIC_STORAGE_ENDPOINT');
    const endpointUrl = new URL(publicEndpoint);
    if (endpointUrl.protocol !== 'https:' || endpointUrl.username || endpointUrl.password || endpointUrl.search || endpointUrl.hash) {
      throw new BadRequestException('ALANKIT_ESIGN_PUBLIC_STORAGE_ENDPOINT must be an HTTPS S3-compatible endpoint.');
    }
    const objectKey = `${randomUUID()}.pdf`;
    await this.ensureBucket(SOURCE_BUCKET);
    await this.client.send(new PutObjectCommand({
      Bucket: SOURCE_BUCKET,
      Key: objectKey,
      Body: pdf,
      ContentType: 'application/pdf',
      Metadata: { 'created-at': new Date().toISOString() },
    }));

    const presignClient = this.createClient(endpointUrl.toString().replace(/\/$/, ''));
    try {
      const sourceUrl = await getSignedUrl(
        presignClient,
        new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: objectKey }),
        { expiresIn: SOURCE_DOCUMENT_TTL_SECONDS },
      );
      return { sourceUrl, objectKey };
    } finally {
      presignClient.destroy();
    }
  }

  async deleteAlankitSourcePdf(objectKey: string): Promise<void> {
    if (!/^[a-f0-9-]{36}\.pdf$/i.test(objectKey)) throw new BadRequestException('Invalid source document key.');
    await this.client.send(new DeleteObjectCommand({ Bucket: SOURCE_BUCKET, Key: objectKey }));
  }

  async cleanupExpiredAlankitSourcePdfs(now = Date.now()): Promise<number> {
    await this.ensureBucket(SOURCE_BUCKET);
    let continuationToken: string | undefined;
    let removed = 0;
    do {
      const page = await this.client.send(new ListObjectsV2Command({
        Bucket: SOURCE_BUCKET,
        ContinuationToken: continuationToken,
      }));
      const expired = (page.Contents ?? []).filter(item =>
        item.Key && item.LastModified && now - item.LastModified.getTime() >= SOURCE_DOCUMENT_MAX_AGE_MS,
      );
      for (const item of expired) {
        await this.client.send(new DeleteObjectCommand({ Bucket: SOURCE_BUCKET, Key: item.Key! }));
        removed++;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return removed;
  }

  async archivePdf(docId: string, pdf: Buffer): Promise<void> {
    this.assertPdf(pdf);
    if (await this.read(docId)) return;
    await this.storePdf(docId, pdf);
  }

  private async storePdf(docId: string, pdf: Buffer) {
    await this.ensureBucket(BUCKET);
    await this.client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: this.key(docId),
      Body: pdf,
      ContentType: 'application/pdf',
      Metadata: { 'archived-at': new Date().toISOString() },
    }));
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
    const reader = response.body.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_PDF_SIZE) {
          await reader.cancel();
          throw new Error('Signed deal sheet exceeds 25 MB');
        }
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    const pdf = Buffer.concat(chunks);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new Error('Digitap did not return a PDF');
    // Preserve the original bytes: regenerating the PDF would invalidate its signature.
    await this.storePdf(docId, pdf);
  }

  private assertPdf(pdf: Buffer) {
    if (pdf.length === 0 || pdf.length > MAX_PDF_SIZE || pdf.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestException('The e-sign document is not a valid PDF or exceeds 25 MB.');
    }
  }
}
