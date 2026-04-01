import {
  Controller,
  UseGuards,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { GedService } from './ged.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { EntityType } from './document.entity';
import { UploadedFilePayload } from './types';

@Controller('ged')
@UseGuards(JwtAuthGuard)
export class GedController {
  constructor(private service: GedService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @UploadedFile() file: UploadedFilePayload,
    @Body() dto: UploadDocumentDto,
    @Req() req: any,
  ) {
    return this.service.uploadDocument(file, dto, req.user.id);
  }

  @Get('documents')
  async getDocuments(@Query() query: SearchDocumentDto) {
    return this.service.getDocuments(query);
  }

  @Get('documents/:id')
  async getDocument(@Param('id') id: string, @Req() req: any) {
    return this.service.getDocument(id, req.user.id);
  }

  @Get('documents/:id/download')
  async downloadDocument(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { buffer, document } = await this.service.downloadDocument(id, req.user.id);

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.send(buffer);
  }

  @Put('documents/:id')
  async updateDocument(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: any,
  ) {
    return this.service.updateDocument(id, dto, req.user.id);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string, @Req() req: any) {
    await this.service.deleteDocument(id, req.user.id);
    return { message: 'Document deleted successfully' };
  }

  @Get('entity/:entityType/:entityId')
  async getEntityDocuments(
    @Param('entityType') entityType: EntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.service.getEntityDocuments(entityType, entityId);
  }

  @Get('documents/:id/versions')
  async getDocumentVersions(@Param('id') id: string) {
    return this.service.getDocumentVersions(id);
  }

  @Get('documents/:id/access-logs')
  async getAccessLogs(@Param('id') id: string) {
    return this.service.getAccessLogs(id);
  }

  @Get('statistics')
  async getStatistics() {
    return this.service.getStatistics();
  }

  @Post('bulk/upload')
  @UseInterceptors(FilesInterceptor('files', 20))
  async bulkUpload(
    @UploadedFiles() files: any[],
    @Body() dto: any,
    @Req() req: any,
  ) {
    return this.service.bulkUpload(
      files,
      dto.entityType,
      dto.entityId,
      dto.documentType,
      req.user.id,
    );
  }

  @Post('bulk/download')
  async bulkDownload(
    @Body('documentIds') documentIds: string[],
    @Req() req: any,
    @Res() res: Response,
  ) {
    const buffer = await this.service.bulkDownload(documentIds, req.user.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="documents.zip"');
    res.send(buffer);
  }

  @Post('documents/:id/share')
  async createShareLink(
    @Param('id') id: string,
    @Body() dto: any,
    @Req() req: any,
  ) {
    return this.service.createShareLink(
      id,
      new Date(dto.expiresAt),
      req.user.id,
      dto.password,
      dto.email,
      dto.maxDownloads,
    );
  }

  @Get('shared/:token')
  async accessSharedDocument(
    @Param('token') token: string,
    @Query('password') password: string,
    @Res() res: Response,
  ) {
    const { buffer, document } = await this.service.accessSharedDocument(token, password);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
    res.send(buffer);
  }

  @Post('documents/:id/link')
  async linkDocument(
    @Param('id') id: string,
    @Body() body: { entityType: string; entityId: string },
  ) {
    await this.service.linkDocuments(id, body.entityType, body.entityId);
    return { message: 'Document linked successfully' };
  }
}
