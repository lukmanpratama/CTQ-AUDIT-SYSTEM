import { Response } from 'express';
import { FilesService } from './files.service';
export declare class FilesController {
    private readonly filesService;
    constructor(filesService: FilesService);
    uploadFile(file: Express.Multer.File): Promise<{
        url: string;
        objectKey: string;
    }>;
    getFile(key: string, res: Response): Promise<void>;
}
//# sourceMappingURL=files.controller.d.ts.map