// src/modules/uploads/uploads.controller.ts
import {
  Controller, Post, Get, Delete, Body, Param, Res,
  UseInterceptors, UploadedFile, UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';
import { UploadFileDto } from './upload-file.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MAX_FILES_PER_BULK_UPLOAD } from '../../config/upload.config';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.uploadSingle(file, dto, user?.id);
  }

  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_BULK_UPLOAD))
  async uploadBulk(
    @UploadedFiles() files: MulterFile[],
    @Body() dto: UploadFileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.uploadBulk(files, dto, user?.id);
  }

  @Post(':documentId/version')
  @UseInterceptors(FileInterceptor('file'))
  async addVersion(
    @Param('documentId') documentId: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.addVersion(documentId, file, user?.id);
  }

  @Get(':documentId/download')
  async download(
    @Param('documentId') documentId: string,
    @Res() res: Response,
    @CurrentUser() user: { id: string },
  ) {
    const { buffer, document } = await this.uploadsService.getFileForDownload(documentId, user?.id);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName || document.nom}"`);
    res.send(buffer);
  }

  @Delete(':documentId')
  async remove(@Param('documentId') documentId: string, @CurrentUser() user: { id: string }) {
    return this.uploadsService.deleteDocument(documentId, user?.id);
  }
}