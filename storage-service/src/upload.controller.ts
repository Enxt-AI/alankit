import {
  Controller,
  Post,
  Delete,
  Param,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { MinioService } from './minio.service';
import { Public } from './auth/decorators/public.decorator';

@Controller('api/upload')
export class UploadController {
  constructor(private readonly minioService: MinioService) {}

  @Post(':bucketName/:pathPrefix')
  async uploadSingleFile(
    @Req() req: any,
    @Param('bucketName') bucketName: string,
    @Param('pathPrefix') pathPrefix: string,
  ) {
    // Note: Fastify Multipart `.file()` gives us a streaming async iterator
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    const buffer = await data.toBuffer();

    // Create a robust unique fileName (user.pdf -> [timestamp]-user.pdf)
    const uniqueFileName = `${pathPrefix}-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const url = await this.minioService.uploadFile(
      bucketName,
      buffer,
      uniqueFileName,
      data.mimetype,
    );

    return {
      success: true,
      url,
      fileName: data.filename,
      size: buffer.length,
      mimetype: data.mimetype,
    };
  }

  @Public()
  @Delete(':bucketName/:fileName')
  async deleteSingleFile(
    @Param('bucketName') bucketName: string,
    @Param('fileName') fileName: string,
  ) {
    if (!bucketName || !fileName) {
      throw new BadRequestException('Bucket name and file name are required');
    }

    await this.minioService.deleteFile(bucketName, fileName);
    return { success: true };
  }
}
