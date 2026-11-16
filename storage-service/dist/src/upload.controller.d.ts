import { MinioService } from './minio.service';
export declare class UploadController {
    private readonly minioService;
    constructor(minioService: MinioService);
    uploadSingleFile(req: any, bucketName: string, pathPrefix: string): Promise<{
        success: boolean;
        url: string;
        fileName: any;
        size: any;
        mimetype: any;
    }>;
    deleteSingleFile(bucketName: string, fileName: string): Promise<{
        success: boolean;
    }>;
}
