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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const common_1 = require("@nestjs/common");
const minio_service_1 = require("./minio.service");
const public_decorator_1 = require("./auth/decorators/public.decorator");
let UploadController = class UploadController {
    minioService;
    constructor(minioService) {
        this.minioService = minioService;
    }
    async uploadSingleFile(req, bucketName, pathPrefix) {
        const data = await req.file();
        if (!data) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        const buffer = await data.toBuffer();
        const uniqueFileName = `${pathPrefix}-${Date.now()}-${data.filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const url = await this.minioService.uploadFile(bucketName, buffer, uniqueFileName, data.mimetype);
        return {
            success: true,
            url,
            fileName: data.filename,
            size: buffer.length,
            mimetype: data.mimetype,
        };
    }
    async deleteSingleFile(bucketName, fileName) {
        if (!bucketName || !fileName) {
            throw new common_1.BadRequestException('Bucket name and file name are required');
        }
        await this.minioService.deleteFile(bucketName, fileName);
        return { success: true };
    }
};
exports.UploadController = UploadController;
__decorate([
    (0, common_1.Post)(':bucketName/:pathPrefix'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('bucketName')),
    __param(2, (0, common_1.Param)('pathPrefix')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "uploadSingleFile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Delete)(':bucketName/:fileName'),
    __param(0, (0, common_1.Param)('bucketName')),
    __param(1, (0, common_1.Param)('fileName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], UploadController.prototype, "deleteSingleFile", null);
exports.UploadController = UploadController = __decorate([
    (0, common_1.Controller)('api/upload'),
    __metadata("design:paramtypes", [minio_service_1.MinioService])
], UploadController);
//# sourceMappingURL=upload.controller.js.map