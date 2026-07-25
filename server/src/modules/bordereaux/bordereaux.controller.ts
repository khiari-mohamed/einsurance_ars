import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors,
  UploadedFile, Res,
} from '@nestjs/common';
import type { File as MulterFile } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { BordereauStatut, BordereauType } from '@prisma/client';
import { BordereauxService } from './bordereaux.service';
import { CreateBordereauDto } from './dto/create-bordereau.dto';
import { UpdateBordereauDto } from './dto/update-bordereau.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';
import { RejectBordereauDto } from './dto/reject-bordereau.dto';
import { SendBordereauDto } from './dto/send-bordereau.dto';
import { PayBordereauDto } from './dto/pay-bordereau.dto';
import { AttachDocumentDto } from './dto/attach-document.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Bordereaux')
@ApiBearerAuth()
@Controller('bordereaux')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BordereauxController {
  constructor(private service: BordereauxService) {}

  // ── Fixed-path GETs — MUST be declared before ':id' routes ────────────

  @Get('statistics')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getStatistics(
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurCode') reassureurCode?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getStatistics({ cedanteId, reassureurCode, startDate, endDate });
  }

  @Get('reports/aging')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getAgingReport() {
    return this.service.getAgingReport();
  }

  @Get('reports/volume')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getVolumeMetrics(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.service.getVolumeMetrics(startDate, endDate);
  }

  @Get('overdue')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getOverdue() {
    return this.service.getOverdue();
  }

  @Get('due-soon')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getDueSoon(@Query('days') days?: number) {
    return this.service.getDueSoon(days ? Number(days) : 7);
  }

  @Get('numero/:numero')
  @RequirePermissions(Permission.AFFAIRES_READ)
  findByNumero(@Param('numero') numero: string) {
    return this.service.findByNumero(numero);
  }

  // ── Collection ──────────────────────────────────────────────────────

  @Get()
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: BordereauType })
  @ApiQuery({ name: 'statut', required: false, enum: BordereauStatut })
  findAll(
    @Query('affaireId') affaireId?: string,
    @Query('type') type?: BordereauType,
    @Query('statut') statut?: BordereauStatut,
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurCode') reassureurCode?: string,
    @Query('search') search?: string,
    @Query('minAmount') minAmount?: number,
    @Query('maxAmount') maxAmount?: number,
    @Query('overdue') overdue?: string,
    @Query('currency') currency?: string,
    @Query('createdByUserId') createdByUserId?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({
      affaireId, type, statut, cedanteId, reassureurCode, search,
      minAmount, maxAmount, overdue, currency, createdByUserId,
      sortBy, sortOrder, page, limit,
    });
  }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Créer un bordereau manuellement' })
  create(@Body() dto: CreateBordereauDto, @CurrentUser() user: any) {
    return this.service.create(dto, user?.id);
  }

  @Post('generate')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Générer automatiquement un bordereau depuis les données de l\'affaire' })
  generate(@Body() dto: GenerateBordereauDto, @CurrentUser() user: any) {
    return this.service.generate(dto, user?.id);
  }

  @Post('bulk-validate')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  bulkValidate(@Body('bordereauIds') ids: string[], @CurrentUser() user: any) {
    return this.service.bulkValidate(ids, user?.id);
  }

  @Post('bulk-archive')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  bulkArchive(@Body('bordereauIds') ids: string[], @CurrentUser() user: any) {
    return this.service.bulkArchive(ids, user?.id);
  }

  @Post('bulk-send')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  bulkSend(@Body('bordereauIds') ids: string[], @Body('recipients') recipients: string[], @CurrentUser() user: any) {
    return this.service.bulkSend(ids, recipients, user?.id);
  }

  @Post('bulk-generate-pdf')
  @RequirePermissions(Permission.AFFAIRES_READ)
  bulkGeneratePdf(@Body('bordereauIds') ids: string[]) {
    return this.service.bulkGeneratePdf(ids);
  }

  // ── Single-resource ─────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions(Permission.AFFAIRES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Put(':id')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Modifier un bordereau (BROUILLON uniquement)' })
  update(@Param('id') id: string, @Body() dto: UpdateBordereauDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user?.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Supprimer un bordereau (BROUILLON uniquement)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user?.id);
  }

  @Patch(':id/submit-validation')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Soumettre pour validation (BROUILLON → EN_VALIDATION)' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.submitForValidation(id, user?.id);
  }

  @Patch(':id/validate')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  @ApiOperation({ summary: 'Valider (EN_VALIDATION → VALIDE)' })
  validate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.validate(id, user?.id);
  }

  @Patch(':id/reject')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  @ApiOperation({ summary: 'Rejeter (EN_VALIDATION → BROUILLON, avec motif)' })
  reject(@Param('id') id: string, @Body() dto: RejectBordereauDto, @CurrentUser() user: any) {
    return this.service.reject(id, dto, user?.id);
  }

  @Patch(':id/send')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  @ApiOperation({ summary: 'Envoyer au partenaire (VALIDE → EMIS)' })
  send(@Param('id') id: string, @Body() dto: SendBordereauDto, @CurrentUser() user: any) {
    return this.service.send(id, dto, user?.id);
  }

  @Post(':id/send-reminder')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  sendReminder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.sendReminder(id, user?.id);
  }

  @Post(':id/pay')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Enregistrer un paiement (peut clôturer EMIS → ACQUITTE)' })
  pay(@Param('id') id: string, @Body() dto: PayBordereauDto, @CurrentUser() user: any) {
    return this.service.pay(id, dto, user?.id);
  }

  @Patch(':id/archive')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Archiver (ACQUITTE → ARCHIVE)' })
  archive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.archive(id, user?.id);
  }

  @Get(':id/history')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getHistory(@Param('id') id: string) {
    return this.service.getHistory(id);
  }

  // ── Documents (backed by DocumentLink/Document) ────────────────────

  @Get(':id/documents')
  @RequirePermissions(Permission.AFFAIRES_READ)
  getDocuments(@Param('id') id: string) {
    return this.service.getDocuments(id);
  }

  @Get(':id/documents/validate')
  @RequirePermissions(Permission.AFFAIRES_READ)
  validateDocuments(@Param('id') id: string) {
    return this.service.validateDocuments(id);
  }

  @Post(':id/documents')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: AttachDocumentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.uploadDocument(id, file, dto, user?.id);
  }

  @Delete(':id/documents/:documentLinkId')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  deleteDocument(
    @Param('id') id: string,
    @Param('documentLinkId') documentLinkId: string,
    @CurrentUser() user: any,
  ) {
    return this.service.deleteDocument(id, documentLinkId, user?.id);
  }

  // ── PDF ──────────────────────────────────────────────────────────────

  @Get(':id/pdf')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Télécharger le PDF du bordereau' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bordereau-${id}.pdf"`);
    res.send(buffer);
  }
}