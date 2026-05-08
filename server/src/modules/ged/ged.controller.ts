import {
  Controller, Get, Post, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DocumentEntityType } from '@prisma/client';
import { GedService } from './ged.service';
import { DocumentChecklistService } from './document-checklist.service';
import { ComplianceService } from './compliance.service';
import { RetentionService } from './retention.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

// Multer file type definition
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

@ApiTags('GED')
@ApiBearerAuth()
@Controller('ged')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GedController {
  constructor(
    private ged: GedService,
    private checklist: DocumentChecklistService,
    private compliance: ComplianceService,
    private retention: RetentionService,
  ) {}

  @Post('upload')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader un document et l\'attacher à une entité' })
  upload(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: any,
  ) { return this.ged.upload(file, dto, user.id); }

  @Get('search')
  @RequirePermissions(Permission.GED_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'search', required: false })
  search(@Query() dto: SearchDocumentDto, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.ged.search(dto, page, limit);
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermissions(Permission.GED_READ)
  getForEntity(@Param('entityType') type: DocumentEntityType, @Param('entityId') id: string) {
    return this.ged.getDocumentsForEntity(type, id);
  }

  @Get(':id/download')
  @RequirePermissions(Permission.GED_READ)
  async download(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const { buffer, document } = await this.ged.download(id, user.id);
    res.setHeader('Content-Type', document.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName ?? document.nom}"`);
    res.send(buffer);
  }

  @Post(':id/version')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader une nouvelle version d\'un document existant' })
  newVersion(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body('comment') comment: string,
    @CurrentUser() user: any,
  ) { return this.ged.uploadNewVersion(id, file, user.id, comment); }

  @Get(':id/versions')
  @RequirePermissions(Permission.GED_READ)
  getVersionHistory(@Param('id') id: string) { return this.ged.getVersionHistory(id); }

  @Post(':id/share')
  @RequirePermissions(Permission.GED_UPLOAD)
  share(@Param('id') id: string, @Body() dto: ShareDocumentDto) { return this.ged.share(id, dto); }

  @Delete(':id')
  @RequirePermissions(Permission.GED_DELETE)
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @CurrentUser() user: any) { return this.ged.delete(id, user.id); }

  // ── Checklists ────────────────────────────────────────────────────
  @Get('checklist/:affaireId')
  @RequirePermissions(Permission.GED_READ)
  getChecklist(@Param('affaireId') affaireId: string) {
    return this.checklist.getForAffaire(affaireId);
  }

  @Post('checklist/:checklistId/items/:itemId/receive')
  @RequirePermissions(Permission.GED_UPLOAD)
  markReceived(
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
    @Body('documentId') documentId: string,
  ) { return this.checklist.markItemReceived(checklistId, itemId, documentId); }

  // ── Compliance ────────────────────────────────────────────────────
  @Get('compliance/report')
  @RequirePermissions(Permission.REPORTING_READ)
  getComplianceReport() { return this.compliance.getComplianceReport(); }

  // ── Retention ─────────────────────────────────────────────────────
  @Get('retention/status')
  @RequirePermissions(Permission.SYSTEM_READ)
  getRetentionStatus() { return this.retention.getRetentionStatus(); }
}