import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DocumentEntityType } from '@prisma/client';
import { GedService } from './ged.service';
import { DocumentChecklistService } from './document-checklist.service';
import { ComplianceService } from './compliance.service';
import { RetentionService } from './retention.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
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

  // ── Upload ──────────────────────────────────────────────────────────
  @Post('upload')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Uploader un document et l'attacher à une entité" })
  upload(@UploadedFile() file: MulterFile, @Body() dto: UploadDocumentDto, @CurrentUser() user: any) {
    return this.ged.upload(file, dto, user.id);
  }

  // NEW: previously had no backend implementation despite being called by
  // gedApi.bulkUpload() (used by BulkUploadModal.tsx).
  @Post('bulk/upload')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 20))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader plusieurs documents en une fois vers la même entité' })
  bulkUpload(
    @UploadedFiles() files: MulterFile[],
    @Body() dto: BulkUploadDto,
    @CurrentUser() user: any,
  ) {
    return this.ged.bulkUpload(files, dto, user.id);
  }

  // NEW: previously had no backend implementation despite being called by
  // gedApi.bulkDownload().
  @Post('bulk/download')
  @RequirePermissions(Permission.GED_READ)
  @ApiOperation({ summary: "Télécharger plusieurs documents sous forme d'archive ZIP" })
  async bulkDownload(@Body('documentIds') documentIds: string[], @Res() res: Response) {
    const buffer = await this.ged.bulkDownload(documentIds);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="documents-${Date.now()}.zip"`);
    res.send(buffer);
  }

  // ── Documents CRUD ────────────────────────────────────────────────
  // FIX: was GET 'search' — frontend (gedApi.getDocuments) always called
  // GET /ged/documents. Renamed to match the contract already in use.
  @Get('documents')
  @RequirePermissions(Permission.GED_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'documentType', required: false })
  @ApiQuery({ name: 'search', required: false })
  search(@Query() dto: SearchDocumentDto) {
    return this.ged.search(dto);
  }

  // NEW: GET /ged/documents/:id — route didn't exist at all.
  @Get('documents/:id')
  @RequirePermissions(Permission.GED_READ)
  getOne(@Param('id') id: string) {
    return this.ged.getDocument(id);
  }

  // NEW: PUT /ged/documents/:id — route didn't exist at all.
  @Put('documents/:id')
  @RequirePermissions(Permission.GED_UPLOAD)
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.ged.updateDocument(id, dto);
  }

  // FIX: was DELETE ':id' (i.e. /ged/:id) — frontend always called
  // DELETE /ged/documents/:id.
  @Delete('documents/:id')
  @RequirePermissions(Permission.GED_DELETE)
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ged.delete(id, user.id);
  }

  // FIX: was GET ':id/download' (i.e. /ged/:id/download) — frontend always
  // called GET /ged/documents/:id/download.
  @Get('documents/:id/download')
  @RequirePermissions(Permission.GED_READ)
  async download(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const { buffer, document } = await this.ged.download(id, user.id);
    res.setHeader('Content-Type', document.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName ?? document.nom}"`);
    res.send(buffer);
  }

  // FIX: path realigned under documents/:id for consistency with the rest
  // of the resource (was ':id/version').
  @Post('documents/:id/version')
  @RequirePermissions(Permission.GED_UPLOAD)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Uploader une nouvelle version d'un document existant" })
  newVersion(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body('comment') comment: string,
    @CurrentUser() user: any,
  ) { return this.ged.uploadNewVersion(id, file, user.id, comment); }

  @Get('documents/:id/versions')
  @RequirePermissions(Permission.GED_READ)
  getVersionHistory(@Param('id') id: string) { return this.ged.getVersionHistory(id); }

  // FIX: was POST ':id/share' (i.e. /ged/:id/share) — frontend always
  // called POST /ged/documents/:id/share.
  @Post('documents/:id/share')
  @RequirePermissions(Permission.GED_UPLOAD)
  share(@Param('id') id: string, @Body() dto: ShareDocumentDto) { return this.ged.share(id, dto); }

  // NEW: GET /ged/shared/:token — public share-link access. MUST be
  // @Public(): this endpoint exists specifically so an external recipient
  // (e.g. a reinsurer) without an ARS login can open the link. Without
  // @Public() here, JwtAuthGuard would reject every request with 401,
  // making the whole "share a document externally" feature unusable.
  @Get('shared/:token')
  @Public()
  @ApiOperation({ summary: 'Accès public à un document partagé via un lien' })
  async accessShared(@Param('token') token: string, @Res() res: Response) {
    const { buffer, document } = await this.ged.accessShared(token);
    res.setHeader('Content-Type', document.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName ?? document.nom}"`);
    res.send(buffer);
  }

  // ── Entity-scoped listings ──────────────────────────────────────────
  @Get('entity/:entityType/:entityId')
  @RequirePermissions(Permission.GED_READ)
  getForEntity(@Param('entityType') type: DocumentEntityType, @Param('entityId') id: string) {
    return this.ged.getDocumentsForEntity(type, id);
  }

  // NEW: convenience wrappers around entity/:entityType/:entityId — called
  // directly by gedApi.getAffaireDocuments/getSinistreDocuments/
  // getPaymentDocuments but never implemented.
  @Get('affaire/:affaireId/documents')
  @RequirePermissions(Permission.GED_READ)
  getAffaireDocuments(@Param('affaireId') affaireId: string) {
    return this.ged.getDocumentsForEntity('AFFAIRE', affaireId);
  }

  @Get('sinistre/:sinistreId/documents')
  @RequirePermissions(Permission.GED_READ)
  getSinistreDocuments(@Param('sinistreId') sinistreId: string) {
    return this.ged.getDocumentsForEntity('SINISTRE', sinistreId);
  }

  // A "payment" can be either an Encaissement or a Decaissement — the
  // frontend route doesn't distinguish, so this checks both.
  @Get('finance/payment/:paymentId/documents')
  @RequirePermissions(Permission.GED_READ)
  @ApiOperation({ summary: 'Documents liés à un paiement (Encaissement ou Décaissement)' })
  async getPaymentDocuments(@Param('paymentId') paymentId: string) {
    const [encaissements, decaissements] = await Promise.all([
      this.ged.getDocumentsForEntity('ENCAISSEMENT', paymentId),
      this.ged.getDocumentsForEntity('DECAISSEMENT', paymentId),
    ]);
    return [...encaissements, ...decaissements];
  }

  // ── Statistics ────────────────────────────────────────────────────
  // NEW: called by gedApi.getStatistics() but never implemented.
  @Get('statistics')
  @RequirePermissions(Permission.GED_READ)
  getStatistics() { return this.ged.getStatistics(); }

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

  // NEW: no way to reject a checklist item previously existed.
  @Post('checklist/:checklistId/items/:itemId/reject')
  @RequirePermissions(Permission.GED_UPLOAD)
  markRejected(
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
  ) { return this.checklist.markItemRejected(checklistId, itemId); }

  // ── Compliance ────────────────────────────────────────────────────
  // NOTE: literal routes ('report', 'reports/missing-documents') are
  // deliberately declared BEFORE the dynamic ':entityType/:entityId' route
  // below — both are 3-segment paths under 'compliance/', so if the
  // dynamic route were registered first it would incorrectly swallow
  // '/ged/compliance/reports/missing-documents' as entityType='reports',
  // entityId='missing-documents'.
  @Get('compliance/report')
  @RequirePermissions(Permission.REPORTING_READ)
  getComplianceReport() { return this.compliance.getComplianceReport(); }

  @Get('compliance/reports/missing-documents')
  @RequirePermissions(Permission.REPORTING_READ)
  getMissingDocumentsReport() { return this.compliance.getMissingDocumentsReport(); }

  @Get('compliance/:entityType/:entityId')
  @RequirePermissions(Permission.GED_READ)
  checkCompliance(
    @Param('entityType') entityType: DocumentEntityType,
    @Param('entityId') entityId: string,
  ) { return this.compliance.checkEntityCompliance(entityType, entityId); }

  // ── Retention ─────────────────────────────────────────────────────
  @Get('retention/status')
  @RequirePermissions(Permission.SYSTEM_READ)
  getRetentionStatus() { return this.retention.getRetentionStatus(); }
}