import { StreamableFile } from '@nestjs/common';
import { MinioService } from './minio.service';
export declare class StorageController {
    private readonly minioService;
    constructor(minioService: MinioService);
    getStorageFile(bucketName: string, req: any, reply: any): Promise<StreamableFile>;
    getStorageFileFlat(bucketName: string, fileName: string, reply: any): Promise<StreamableFile>;
}
