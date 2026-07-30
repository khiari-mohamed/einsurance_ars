// src/modules/uploads/uploads.controller.ts
import {
  Controller, Post, Get, Delete, Body, Param, Query, Res, UseGuards,
  UseInterceptors, UploadedFile, UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';
import type { Response } from 'express';
import { UploadsService } from './uploads.service';
import { UploadFileDto } from './upload-file.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MAX_FILES_PER_BULK_UPLOAD } from '../../config/upload.config';
// FIX (SWIFT/GED gap): this controller had NO guards at all — every route
// (including delete) was reachable by anyone with no Bearer token. Every
// other controller reviewed across this whole engagement (Ged, Finances,
// Affaires, Référentiel...) is guarded; this was the one hole. Mirrors
// GedController's exact guard + permission pattern.
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../config/permissions.config';

@Controller('uploads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.uploadSingle(file, dto, user?.id);
  }

  @Post('bulk')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_BULK_UPLOAD))
  async uploadBulk(
    @UploadedFiles() files: MulterFile[],
    @Body() dto: UploadFileDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.uploadBulk(files, dto, user?.id);
  }

  @Post(':documentId/version')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  async addVersion(
    @Param('documentId') documentId: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: { id: string },
  ) {
    return this.uploadsService.addVersion(documentId, file, user?.id);
  }

  @Get(':documentId/download')
  @RequirePermissions(Permission.GED_READ)
  async download(
    @Param('documentId') documentId: string,
    @Res() res: Response,
    @CurrentUser() user: { id: string },
    @Query('inline') inline?: string,
  ) {
    const { buffer, document } = await this.uploadsService.getFileForDownload(documentId, user?.id);
    const filename = document.originalName || document.nom;
    const disposition = inline === 'true' ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`;
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    res.send(buffer);
  }

  @Delete(':documentId')
  @RequirePermissions(Permission.GED_DELETE)
  async remove(@Param('documentId') documentId: string, @CurrentUser() user: { id: string }) {
    return this.uploadsService.deleteDocument(documentId, user?.id);
  }
}