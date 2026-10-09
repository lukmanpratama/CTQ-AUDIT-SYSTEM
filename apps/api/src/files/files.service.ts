import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class FilesService {
    private s3Client: S3Client;
    private readonly logger = new Logger(FilesService.name);
    private bucketName: string;
    private endpoint: string;

    constructor(private configService: ConfigService) {
        this.endpoint = this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000';
        this.s3Client = new S3Client({
            endpoint: this.endpoint,
            region: this.configService.get<string>('S3_REGION') || 'us-east-1',
            credentials: {
                accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin',
                secretAccessKey: this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin',
            },
            forcePathStyle: true, // Required for MinIO
        });
        this.bucketName = this.configService.get<string>('S3_BUCKET') || 'ctqaudit';
    }

    async uploadFile(file: Express.Multer.File): Promise<{ url: string; objectKey: string }> {
        // Basic sanitization
        const sanitizeName = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
        const objectKey = `${uuidv4()}-${sanitizeName}`;

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: objectKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );

        const url = `${this.endpoint}/${this.bucketName}/${objectKey}`;
        return { url, objectKey };
    }

    async getFileStream(key: string): Promise<{ stream: Readable, contentType: string }> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });

            const response = await this.s3Client.send(command);

            if (!response.Body) {
                throw new NotFoundException('Empty file body');
            }

            // Read the full body into memory immediately via SDK to bypass socket/keep-alive issues and Docker DNS fetch errors
            const byteArray = await response.Body.transformToByteArray();
            const buffer = Buffer.from(byteArray);

            return {
                stream: Readable.from(buffer),
                contentType: response.ContentType || 'application/octet-stream',
            };
        } catch (err: any) {
            this.logger.error(`Error retrieving file ${key}: ${err.message}`);
            throw new NotFoundException('File not found or unable to stream from MinIO');
        }
    }
}
