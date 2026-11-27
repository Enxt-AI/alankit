import { Injectable, NotFoundException, BadRequestException} from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const ESIGN_BUCKET = 'esign-documents';

@Injectable()
export class SettingsService {
  private readonly logger = new PinoNestLogger('stocks-service', '');
  private s3Client: S3Client;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const endpoint = this.configService.get('MINIO_ENDPOINT', 'http://localhost:9000');
    const accessKeyId = this.configService.get('MINIO_ACCESS_KEY', 'minioadmin');
    const secretAccessKey = this.configService.get('MINIO_SECRET_KEY', 'minioadmin');

    this.s3Client = new S3Client({
      endpoint,
      region: 'ap-south-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',   // Prevents MetadataTooLarge on MinIO
      responseChecksumValidation: 'WHEN_REQUIRED',
   });
    this.logger.log(`MinIO S3 client configured targeting ${endpoint}`);
 }

  /**
   * Convert a stored pdfUrl to a browser-accessible root-relative path.
   *
   * Nginx already proxies  /storage/* → minio:9000  in nginx.conf,
   * so returning "/storage/esign-documents/file.pdf" works on any domain
   * with zero env-var configuration.
   *
   * Handles both formats:
   *   Relative:  "esign-documents/template-xxx.pdf"           → "/storage/esign-documents/template-xxx.pdf"
   *   Legacy:    "http://-minio-staging:9000/esign-doc/..." → "/storage/esign-documents/template-xxx.pdf"
   */
  private toPublicUrl(pdfUrl: string | null | undefined): string | null {
    if (!pdfUrl) return null;

    let relativePath: string;
    if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
      try {
        relativePath = new URL(pdfUrl).pathname.replace(/^\//, '');
     } catch {
        return pdfUrl;
     }
   } else {
      relativePath = pdfUrl;
   }
    // Nginx proxies /storage/* → MinIO root, so path maps 1-to-1
    return `/storage/${relativePath}`;
 }

  async getAllESignTemplates() {
    const templates = await this.prisma.eSignTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { fullName: true, email: true } },
     },
   });
    // Attach a browser-accessible publicPdfUrl to each template
    return templates.map((t) => ({
      ...t,
      publicPdfUrl: this.toPublicUrl(t.pdfUrl),
   }));
 }

  async createESignTemplate(data: { templateId: string; pdfUrl?: string }, adminId: string) {
    if (!data.templateId) {
      throw new BadRequestException('Template ID is required');
   }

    // Deactivate existing templates
    await this.prisma.eSignTemplate.updateMany({
      where: { isActive: true },
      data: { isActive: false },
   });

    return this.prisma.eSignTemplate.create({
      data: {
        templateId: data.templateId,
        pdfUrl: data.pdfUrl || null,
        createdById: adminId,
        isActive: true,
     }
   });
 }

  async updateESignTemplate(id: string, templateId: string, pdfUrl?: string) {
    const template = await this.prisma.eSignTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    if (!templateId) throw new BadRequestException('Template ID is required');
    const updateData: any = { templateId };
    if (pdfUrl !== undefined) {
      updateData.pdfUrl = pdfUrl || null;
   }
    return this.prisma.eSignTemplate.update({
      where: { id },
      data: updateData
   });
 }

  async getActiveESignTemplate() {
    return this.prisma.eSignTemplate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
   });
 }

  async deleteESignTemplate(id: string) {
    const template = await this.prisma.eSignTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException('Template not found');
   }

    if (template.isActive) {
      throw new BadRequestException('Cannot delete an active template. Please set another template as active first by creating a new one.');
   }

    // Attempt to delete the PDF from MinIO if it exists.
    // pdfUrl can be:
    //   - Relative path (new format): "esign-documents/template-xxx.pdf"
    //   - Absolute URL (legacy format): "http://localhost:9000/esign-documents/template-xxx.pdf"
    if (template.pdfUrl) {
      try {
        let bucket: string | undefined;
        let key: string | undefined;

        if (template.pdfUrl.startsWith('http://') || template.pdfUrl.startsWith('https://')) {
          // Legacy absolute URL — extract bucket + key from pathname
          const url = new URL(template.pdfUrl);
          const pathParts = url.pathname.split('/').filter((p) => p);
          if (pathParts.length >= 2 && pathParts[0] === ESIGN_BUCKET) {
            bucket = ESIGN_BUCKET;
            key = pathParts.slice(1).join('/');
         }
       } else {
          // New relative format: "esign-documents/key.pdf"
          const pathParts = template.pdfUrl.split('/').filter((p) => p);
          if (pathParts.length >= 2 && pathParts[0] === ESIGN_BUCKET) {
            bucket = ESIGN_BUCKET;
            key = pathParts.slice(1).join('/');
         }
       }

        if (bucket && key) {
          await this.s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          this.logger.log(`Deleted PDF from MinIO: ${key}`);
       }
     } catch (error: any) {
        this.logger.warn(`Failed to delete PDF from MinIO during template deletion: ${error.message}`);
     }
   }

    return this.prisma.eSignTemplate.delete({
      where: { id },
   });
 }

  /**
   * Upload an eSign HTML directly to MinIO (esign-documents bucket).
   * Returns the MinIO URL that fetchESignHtml in orders.service.ts can resolve.
   */
  async uploadESignHtml(filename: string, buffer: Buffer): Promise<{ url: string; publicUrl: string }> {
    // Ensure the bucket exists and is publicly readable
    await this.ensureBucketExists(ESIGN_BUCKET);

    // -- AUTO TEMPLATIFY: Convert raw pdf2htmlEX output into {{placeholder}} format --
    let htmlStr = buffer.toString('utf-8');
    
    // Extract style block(s) to avoid matching coordinates in CSS rules
    const styleBlocks: string[] = [];
    htmlStr = htmlStr.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match) => {
      styleBlocks.push(match);
      return `<!-- STYLE_BLOCK_PLACEHOLDER_${styleBlocks.length - 1} -->`;
   });
    
    // 1. Tag-Tolerant Replacer (Finds text even if split by <span> tags)
    const replace = (searchText: string, placeholder: string) => {
      const regexStr = searchText.split('').map(char => {
        if (char === ' ') return '(?:\\s+|<[^>]+>)+';
        const escaped = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped + '(?:<[^>]+>)*?';
     }).join('');
      const regex = new RegExp(regexStr, 'g');
      htmlStr = htmlStr.replace(regex, placeholder);
   };

    // Generic Dates & Quantities
    replace('Today date', '{{date_top}}'); 
    replace('15000', '{{quantity}}');
    replace('1900', '{{price}}');
    replace('INR 200000', '{{total_consideration}}');
    replace('DEMAT', '{{mode_of_delivery}}');
    replace('T+7', '{{expected_transfer_date}}');

    // Share & Client Info
    replace('STOCK NAME', '{{share_name}}');
    replace('STOCK ISIN', '{{isin}}');
    replace('CL NAME', '{{client_name}}');
    replace('CLIENT ADDRESS', '{{client_address_line1}}');

    // Buyer Info (Seller info is intentionally left hardcoded as per request)
    replace('BUYER NAME', '{{buyer_name}}');
    replace('00010310', '{{buyer_client_id}}');
    replace('BUYER DP NAME', '{{buyer_dp_name}}');
    replace('12345678', '{{buyer_dp_id}}');
    replace('12096600', '{{buyer_dp_id}}');
    replace('BUYERPAN123', '{{buyer_pan}}');
    replace('AAFCT9640K', '{{buyer_pan}}');
    replace('BUYER BANK', '{{buyer_bank_name}}');
    replace('112233445566', '{{buyer_account_no}}');
    replace('57500001280322', '{{buyer_account_no}}');
    replace('BANK12345', '{{buyer_ifsc}}');

    // 2. Future-Proofing: Unscramble any native {{placeholders}} that got broken by pdf2htmlEX
    // This allows you to just type {{client_name}} in Word in the future and it will work!
    const fixPlaceholdersRegex = /\{(?:<[^>]+>)*?\{([\s\S]*?)\}(?:<[^>]+>)*?\}/g;
    htmlStr = htmlStr.replace(fixPlaceholdersRegex, (match, inner) => {
       const cleanInner = inner.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
       return `{{${cleanInner}}}`;
   });

    // 3. Fix Layout Truncation: pdf2htmlEX uses overflow:hidden on text containers (.c), 
    // which causes long dynamic names (like share name) to be cut off (shifted).
    htmlStr = htmlStr.replace(/\.c\{([^}]*)overflow:hidden([^}]*)\}/g, '.c{$1overflow:visible$2}');

    // Restore style block(s)
    styleBlocks.forEach((block, index) => {
      htmlStr = htmlStr.replace(`<!-- STYLE_BLOCK_PLACEHOLDER_${index} -->`, block);
   });

    // Convert back to buffer for upload
    const finalBuffer = Buffer.from(htmlStr, 'utf-8');

    const extension = filename.endsWith('.html') ? '.html' : '.html';
    const uniqueFilename = `template-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;

    const command = new PutObjectCommand({
      Bucket: ESIGN_BUCKET,
      Key: uniqueFilename,
      Body: finalBuffer,
      ContentType: 'text/html',
   });

    await this.s3Client.send(command);

    // Store a relative path (bucket/key) so the URL is not locked to a specific
    // MinIO host (e.g. localhost vs -minio-staging). fetchESignHtml in
    // orders.service.ts resolves the full URL using MINIO_ENDPOINT at runtime.
    const relativeUrl = `${ESIGN_BUCKET}/${uniqueFilename}`;
    const publicUrl = this.toPublicUrl(relativeUrl)!;
    this.logger.log(`Uploaded eSign HTML to MinIO: ${publicUrl} (${buffer.length} bytes)`);

    return {
      url: relativeUrl,       // stored in DB (environment-agnostic)
      publicUrl,              // returned to admin UI for immediate preview
   };
 }

  /**
   * Ensure a MinIO bucket exists and has public read policy.
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
   } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Bucket '${bucketName}' not found. Creating it...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        this.logger.log(`Bucket '${bucketName}' created.`);
     } else {
        throw error;
     }
   }

    // Set public read-only policy
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
         },
        ],
     };
      await this.s3Client.send(
        new PutBucketPolicyCommand({ Bucket: bucketName, Policy: JSON.stringify(policy) }),
      );
   } catch (policyError) {
      this.logger.warn(`Failed to set public policy on '${bucketName}'`, policyError);
   }
 }

  async getRevenueSharingSettings() {
    // Seed default settings if they do not exist
    const internal = await this.prisma.revenueShareSetting.findUnique({ where: { type: 'INTERNAL' } });
    if (!internal) {
      try {
        await this.prisma.revenueShareSetting.create({
          data: { type: 'INTERNAL', revenuePercentage: 0, incentivePercentage: 0 }
       });
     } catch (err) {
        // Ignore unique constraint error if concurrent requests occur
     }
   }

    const external = await this.prisma.revenueShareSetting.findUnique({ where: { type: 'EXTERNAL' } });
    if (!external) {
      try {
        await this.prisma.revenueShareSetting.create({
          data: { type: 'EXTERNAL', revenuePercentage: 0 }
       });
     } catch (err) {
        // Ignore unique constraint error
     }
   }

    return this.prisma.revenueShareSetting.findMany();
 }

  async updateRevenueSharingSettings(data: { type: string; revenuePercentage: number; incentivePercentage?: number }) {
    const { type, revenuePercentage, incentivePercentage } = data;
    if (type !== 'INTERNAL' && type !== 'EXTERNAL') {
      throw new BadRequestException('Invalid revenue sharing type');
   }

    return this.prisma.revenueShareSetting.upsert({
      where: { type },
      update: {
        revenuePercentage,
        incentivePercentage: type === 'INTERNAL' ? (incentivePercentage ?? 0) : 0,
     },
      create: {
        type,
        revenuePercentage,
        incentivePercentage: type === 'INTERNAL' ? (incentivePercentage ?? 0) : 0,
     },
   });
 }

  async proposeRevenueSharingUpdate(data: { type: string; revenuePercentage: number; incentivePercentage?: number }, adminId: string) {
    const { type, revenuePercentage, incentivePercentage } = data;
    if (type !== 'INTERNAL' && type !== 'EXTERNAL') {
      throw new BadRequestException('Invalid revenue sharing type');
   }

    const proposedData = {
      type,
      revenuePercentage,
      incentivePercentage: type === 'INTERNAL' ? (incentivePercentage ?? 0) : 0,
   };

    // Find if there's an existing entity ID (actually revenue settings just use type as identifier in the proposedData)
    // We can leave entityId null or set it to 'INTERNAL' / 'EXTERNAL'
    const existing = await this.prisma.revenueShareSetting.findUnique({ where: { type } });
    
    return this.prisma.changeRequest.create({
      data: {
        entityType: 'REVENUE_SHARING',
        entityId: existing?.id, // Optional, could just rely on proposedData.type
        proposedData,
        status: 'PENDING',
        requestedById: adminId,
     },
   });
 }
}
