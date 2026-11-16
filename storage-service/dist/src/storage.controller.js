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
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const minio_service_1 = require("./minio.service");
const public_decorator_1 = require("./auth/decorators/public.decorator");
let StorageController = class StorageController {
    minioService;
    constructor(minioService) {
        this.minioService = minioService;
    }
    async getStorageFile(bucketName, req, reply) {
        const rawPath = req.params['*'] || '';
        const fileResult = await this.minioService.getObject(bucketName, rawPath);
        if (!fileResult || !fileResult.body) {
            throw new common_1.NotFoundException(`File ${rawPath} not found in bucket ${bucketName}`);
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
        return new common_1.StreamableFile(fileResult.body);
    }
    async getStorageFileFlat(bucketName, fileName, reply) {
        const fileResult = await this.minioService.getObject(bucketName, fileName);
        if (!fileResult || !fileResult.body) {
            throw new common_1.NotFoundException(`File ${fileName} not found in bucket ${bucketName}`);
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
        return new common_1.StreamableFile(fileResult.body);
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':bucketName/*'),
    __param(0, (0, common_1.Param)('bucketName')),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getStorageFile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(':bucketName/:fileName'),
    __param(0, (0, common_1.Param)('bucketName')),
    __param(1, (0, common_1.Param)('fileName')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], StorageController.prototype, "getStorageFileFlat", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.Controller)(['storage', 'api/storage']),
    __metadata("design:paramtypes", [minio_service_1.MinioService])
], StorageController);
//# sourceMappingURL=storage.controller.js.map