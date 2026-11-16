"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MinioService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MinioService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
let MinioService = MinioService_1 = class MinioService {
    s3Client;
    logger = new common_1.Logger(MinioService_1.name);
    endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
    accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin';
    secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
    constructor() {
        this.s3Client = new client_s3_1.S3Client({
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
    async ensureBucketExists(bucketName) {
        try {
            await this.s3Client.send(new client_s3_1.HeadBucketCommand({ Bucket: bucketName }));
        }
        catch (error) {
            if (error.name === 'NotFound' ||
                error.$metadata?.httpStatusCode === 404) {
                this.logger.log(`Bucket '${bucketName}' not found. Creating it...`);
                try {
                    await this.s3Client.send(new client_s3_1.CreateBucketCommand({ Bucket: bucketName }));
                    this.logger.log(`Bucket '${bucketName}' created successfully.`);
                }
                catch (createError) {
                    this.logger.error(`Failed to create bucket '${bucketName}'`, createError);
                    throw createError;
                }
            }
            else {
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
            await this.s3Client.send(new client_s3_1.PutBucketPolicyCommand({
                Bucket: bucketName,
                Policy: JSON.stringify(policy),
            }));
            this.logger.log(`Bucket '${bucketName}' verified public read-only.`);
        }
        catch (policyError) {
            this.logger.warn(`Failed to set policy on '${bucketName}'`, policyError);
        }
    }
    async uploadFile(bucketName, fileBuffer, fileName, mimetype) {
        try {
            await this.ensureBucketExists(bucketName);
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: mimetype,
            });
            await this.s3Client.send(command);
            const fileUrl = `/storage/${bucketName}/${fileName}`;
            this.logger.log(`Uploaded ${fileName} → ${fileUrl}`);
            return fileUrl;
        }
        catch (error) {
            this.logger.error(`Failed to upload ${fileName} to ${bucketName}`, error);
            throw error;
        }
    }
    async deleteFile(bucketName, fileName) {
        try {
            const command = new client_s3_1.DeleteObjectCommand({
                Bucket: bucketName,
                Key: fileName,
            });
            await this.s3Client.send(command);
            this.logger.log(`Deleted ${fileName} from ${bucketName}`);
        }
        catch (error) {
            this.logger.error(`Failed to delete ${fileName} from ${bucketName}`, error);
            throw error;
        }
    }
    async getObject(bucketName, fileName) {
        try {
            const command = new client_s3_1.GetObjectCommand({
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
        }
        catch (error) {
            if (error.name === 'NoSuchKey' ||
                error.name === 'NotFound' ||
                error.$metadata?.httpStatusCode === 404) {
                return null;
            }
            this.logger.error(`Failed to get ${fileName} from ${bucketName}`, error);
            throw error;
        }
    }
};
exports.MinioService = MinioService;
exports.MinioService = MinioService = MinioService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], MinioService);
//# sourceMappingURL=minio.service.js.map