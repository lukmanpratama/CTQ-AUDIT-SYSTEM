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
var FilesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilesService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const config_1 = require("@nestjs/config");
const stream_1 = require("stream");
let FilesService = FilesService_1 = class FilesService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(FilesService_1.name);
        this.endpoint = this.configService.get('S3_ENDPOINT') || 'http://localhost:9000';
        this.s3Client = new client_s3_1.S3Client({
            endpoint: this.endpoint,
            region: this.configService.get('S3_REGION') || 'us-east-1',
            credentials: {
                accessKeyId: this.configService.get('S3_ACCESS_KEY') || 'minioadmin',
                secretAccessKey: this.configService.get('S3_SECRET_KEY') || 'minioadmin',
            },
            forcePathStyle: true,
        });
        this.bucketName = this.configService.get('S3_BUCKET') || 'ctqaudit';
    }
    async uploadFile(file) {
        const sanitizeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        const objectKey = `${(0, uuid_1.v4)()}-${sanitizeName}`;
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: objectKey,
            Body: file.buffer,
            ContentType: file.mimetype,
        }));
        const url = `${this.endpoint}/${this.bucketName}/${objectKey}`;
        return { url, objectKey };
    }
    async getFileStream(key) {
        try {
            const command = new client_s3_1.GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            const response = await this.s3Client.send(command);
            if (!response.Body) {
                throw new common_1.NotFoundException('Empty file body');
            }
            const byteArray = await response.Body.transformToByteArray();
            const buffer = Buffer.from(byteArray);
            return {
                stream: stream_1.Readable.from(buffer),
                contentType: response.ContentType || 'application/octet-stream',
            };
        }
        catch (err) {
            this.logger.error(`Error retrieving file ${key}: ${err.message}`);
            throw new common_1.NotFoundException('File not found or unable to stream from MinIO');
        }
    }
};
exports.FilesService = FilesService;
exports.FilesService = FilesService = FilesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], FilesService);
//# sourceMappingURL=files.service.js.map