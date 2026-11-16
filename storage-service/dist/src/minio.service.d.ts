export declare class MinioService {
    private s3Client;
    private readonly logger;
    private readonly endpoint;
    private readonly accessKeyId;
    private readonly secretAccessKey;
    constructor();
    private ensureBucketExists;
    uploadFile(bucketName: string, fileBuffer: Buffer, fileName: string, mimetype: string): Promise<string>;
    deleteFile(bucketName: string, fileName: string): Promise<void>;
    getObject(bucketName: string, fileName: string): Promise<{
        body: import("@smithy/types").StreamingBlobPayloadOutputTypes | undefined;
        contentType: string;
        contentLength: number | undefined;
        etag: string | undefined;
        lastModified: Date | undefined;
    } | null>;
}
