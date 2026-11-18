import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { MinioService } from './minio.service';
import { Public } from './auth/decorators/public.decorator';

@Controller(['storage', 'api/storage'])
export class StorageController {
  constructor(private readonly minioService: MinioService) {}

  @Public()
  @Get(':bucketName/*')
  async getStorageFile(
    @Param('bucketName') bucketName: string,
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const rawPath = req.params['*'] || '';
    const fileResult = await this.minioService.getObject(bucketName, rawPath);
    if (!fileResult || !fileResult.body) {
      throw new NotFoundException(
        `File ${rawPath} not found in bucket ${bucketName}`,
      );
    }

    reply.header('Content-Type', fileResult.contentType);
    if (fileResult.contentLength != null) {
      reply.header('Content-Length', fileResult.contentLength);
    }
    if (fileResult.etag) {
      reply.header('ETag', fileResult.etag);
    }
    if (fileResult.lastModified) {
      reply.header('Last-Modified', fileResult.lastModified.toUTCString());
    }
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');

    return new StreamableFile(fileResult.body as any);
  }

  @Public()
  @Get(':bucketName/:fileName')
  async getStorageFileFlat(
    @Param('bucketName') bucketName: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) reply: any,
  ) {
    const fileResult = await this.minioService.getObject(bucketName, fileName);
    if (!fileResult || !fileResult.body) {
      throw new NotFoundException(
        `File ${fileName} not found in bucket ${bucketName}`,
      );
    }

    reply.header('Content-Type', fileResult.contentType);
    if (fileResult.contentLength != null) {
      reply.header('Content-Length', fileResult.contentLength);
    }
    if (fileResult.etag) {
      reply.header('ETag', fileResult.etag);
    }
    if (fileResult.lastModified) {
      reply.header('Last-Modified', fileResult.lastModified.toUTCString());
    }
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');

    return new StreamableFile(fileResult.body as any);
  }
}
