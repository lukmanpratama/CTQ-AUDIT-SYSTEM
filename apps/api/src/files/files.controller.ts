import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, Get, Param, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
    constructor(private readonly filesService: FilesService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // Max 10MB
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }
        return this.filesService.uploadFile(file);
    }

    @Get(':key')
    async getFile(@Param('key') key: string, @Res() res: Response) {
        const { stream, contentType } = await this.filesService.getFileStream(key);
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000',
        });
        stream.pipe(res);
    }
}
