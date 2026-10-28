import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
export declare class FilesService {
    private configService;
    private s3Client;
    private readonly logger;
    private bucketName;
    private endpoint;
    constructor(configService: ConfigService);
    uploadFile(file: Express.Multer.File): Promise<{
        url: string;
        objectKey: string;
    }>;
    getFileStream(key: string): Promise<{
        stream: Readable;
        contentType: string;
    }>;
}
//# sourceMappingURL=files.service.d.ts.map