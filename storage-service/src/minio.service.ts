import { Injectable, NotFoundException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { PinoNestLogger } from '@smc/logger';

const service = 'storage-service';
const ctx = 'MinioService';

@Injectable()
export class MinioService {
  private s3Client: S3Client;
  private readonly logger = new PinoNestLogger(service, ctx);

  private readonly endpoint =
    process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  private readonly accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin';
  private readonly secretAccessKey =
    process.env.MINIO_SECRET_KEY || 'minioadmin';

  constructor() {
    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: 'ap-south-1',
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    this.logger.log(`MinIO Client configured targeting ${this.endpoint}`);
  }

  private async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        this.logger.log(`Bucket '${bucketName}' not found. Creating it...`);
        try {
          await this.s3Client.send(
            new CreateBucketCommand({ Bucket: bucketName }),
          );
          this.logger.log(`Bucket '${bucketName}' created successfully.`);
        } catch (createError) {
          this.logger.error(
            { bucketName },
            `Failed to create bucket '${bucketName}'`,
          );
          throw createError;
        }
      } else {
        throw error;
      }
    }

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
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        }),
      );
      this.logger.log(`Bucket '${bucketName}' verified public read-only.`);
    } catch (policyError) {
      this.logger.warn(
        { bucketName },
        `Failed to set policy on '${bucketName}'`,
      );
    }
  }

  async uploadFile(
    bucketName: string,
    fileBuffer: Buffer,
    fileName: string,
    mimetype: string,
  ): Promise<string> {
    if (bucketName === 'signed-deal-sheets') throw new NotFoundException();
    try {
      await this.ensureBucketExists(bucketName);

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: fileBuffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);

      const fileUrl = `/storage/${bucketName}/${fileName}`;
      this.logger.log({ bucketName, fileName }, `Uploaded ${fileName} → ${fileUrl}`);

      return fileUrl;
    } catch (error) {
      this.logger.error(
        { bucketName, fileName, err: error },
        `Failed to upload ${fileName} to ${bucketName}`,
      );
      throw error;
    }
  }

  async deleteFile(bucketName: string, fileName: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
      await this.s3Client.send(command);
      this.logger.log({ bucketName, fileName }, `Deleted ${fileName} from ${bucketName}`);
    } catch (error) {
      this.logger.error(
        { bucketName, fileName, err: error },
        `Failed to delete ${fileName} from ${bucketName}`,
      );
      throw error;
    }
  }

  async getObject(bucketName: string, fileName: string) {
    if (bucketName === 'signed-deal-sheets') throw new NotFoundException();
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      });
      const response = await this.s3Client.send(command);
      return {
        body: response.Body,
        contentType: response.ContentType || 'application/octet-stream',
        contentLength: response.ContentLength,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (error: any) {
      if (
        error.name === 'NoSuchKey' ||
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      this.logger.error(
        { bucketName, fileName, err: error },
        `Failed to get ${fileName} from ${bucketName}`,
      );
      throw error;
    }
  }
}