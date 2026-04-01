import { 
  Controller, Get, Post, Put, Delete, Param, Body, Query, 
  UseGuards, Request, Patch, UseInterceptors, UploadedFile 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BordereauxService } from './bordereaux.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/users.entity';
import { CreateBordereauDto } from './dto/create-bordereau.dto';
import { UpdateBordereauDto } from './dto/update-bordereau.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { PaymentDto } from './dto/payment.dto';
import { BordereauType, BordereauStatus } from './bordereaux.entity';
import { Multer } from 'multer';

@Controller('bordereaux')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BordereauxController {
  constructor(private service: BordereauxService) {}

  @Post()
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  create(@Body() dto: CreateBordereauDto, @Request() req) {
    return this.service.create(dto, req.user.userId);
  }

  @Post('generate')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  generate(@Body() dto: GenerateBordereauDto, @Request() req) {
    return this.service.generateFromPeriod(dto, req.user.userId);
  }

  @Get()
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  findAll(
    @Query('type') type?: BordereauType,
    @Query('status') status?: BordereauStatus,
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurId') reassureurId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('minAmount') minAmount?: string,
    @Query('maxAmount') maxAmount?: string,
    @Query('overdue') overdue?: string,
    @Query('devise') devise?: string,
    @Query('createdById') createdById?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      type,
      status,
      cedanteId,
      reassureurId,
      startDate,
      endDate,
      search,
      minAmount: minAmount ? parseFloat(minAmount) : undefined,
      maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      overdue,
      devise,
      createdById,
      sortBy,
      sortOrder,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('statistics')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getStatistics(
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurId') reassureurId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.getStatistics({ cedanteId, reassureurId, startDate, endDate });
  }

  @Get('reports/aging')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getAgingReport() {
    return this.service.getAgingReport();
  }

  @Get('reports/volume')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getVolumeMetrics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this.service.getVolumeMetrics(new Date(startDate), new Date(endDate));
  }

  @Get('overdue')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  getOverdue() {
    return this.service.getOverdueBordereaux();
  }

  @Get('due-soon')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  getDueSoon(@Query('days') days?: string) {
    return this.service.getDueSoon(days ? parseInt(days) : 7);
  }

  @Get('cedantes')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getByCedante() {
    return this.service.findAll({});
  }

  @Get('reassureurs')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getByReassureur() {
    return this.service.findAll({});
  }

  @Get('sinistres')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getBySinistre() {
    return this.service.findAll({});
  }

  @Get('situations')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getBySituation() {
    return this.service.findAll({});
  }

  @Get('dashboard')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getDashboard() {
    return this.service.getStatistics({});
  }

  @Get('numero/:numero')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  findByNumero(@Param('numero') numero: string) {
    return this.service.getBordereauByNumero(numero);
  }

  @Post(':id/send-reminder')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  sendReminder(@Param('id') id: string, @Request() req) {
    return this.service.sendPaymentReminder(id, req.user.userId);
  }

  @Get(':id')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  update(@Param('id') id: string, @Body() dto: UpdateBordereauDto, @Request() req) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @Request() req) {
    return this.service.updateStatus(id, dto.status, req.user.userId);
  }

  @Post(':id/submit-validation')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  submitForValidation(@Param('id') id: string, @Request() req) {
    return this.service.submitForValidation(id, req.user.userId);
  }

  @Post(':id/validate')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE)
  validate(@Param('id') id: string, @Request() req) {
    return this.service.validate(id, req.user.userId);
  }

  @Post(':id/reject')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE)
  reject(@Param('id') id: string, @Body('reason') reason: string, @Request() req) {
    return this.service.reject(id, reason, req.user.userId);
  }

  @Post(':id/send')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  send(@Param('id') id: string, @Body('recipients') recipients: string[], @Request() req) {
    return this.service.sendBordereau(id, recipients, req.user.userId);
  }

  @Post(':id/pay')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  markAsPaid(@Param('id') id: string, @Body() paymentData: PaymentDto, @Request() req) {
    return this.service.markAsPaid(id, paymentData, req.user.userId);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  addDocument(
    @Param('id') id: string,
    @UploadedFile() file: Multer.File,
    @Body() dto: AddDocumentDto,
    @Request() req,
  ) {
    return this.service.addDocument(id, file, dto, req.user.userId);
  }

  @Get(':id/documents')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  getDocuments(@Param('id') id: string) {
    return this.service.getDocuments(id);
  }

  @Get(':id/documents/validate')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  validateDocuments(@Param('id') id: string) {
    return this.service.validateDocumentCompleteness(id);
  }

  @Get(':id/pdf')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_GENERAL)
  async generatePdf(@Param('id') id: string, @Request() req) {
    const { pdfBuffer, fileName } = await this.service.generatePdf(id, req.user.userId);
    
    // Set response headers for PDF download
    return {
      pdfBuffer,
      fileName,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      }
    };
  }

  @Post(':id/affaires')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  addAffaires(@Param('id') id: string, @Body('affaireIds') affaireIds: string[], @Request() req) {
    return this.service.addAffairesToBordereau(id, affaireIds, req.user.userId);
  }

  @Post(':id/archive')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE)
  archive(@Param('id') id: string, @Request() req) {
    return this.service.archive(id, req.user.userId);
  }

  @Post('bulk-archive')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.COMPTABLE)
  bulkArchive(@Body('bordereauIds') bordereauIds: string[], @Request() req) {
    return this.service.bulkArchive(bordereauIds, req.user.userId);
  }

  @Delete(':id')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post('generate-sinistre')
  @Roles(UserRole.DIRECTEUR_COMMERCIAL, UserRole.DIRECTEUR_FINANCIER)
  generateSinistre(@Body('sinistreId') sinistreId: string, @Request() req) {
    return this.service.generateSinistre(sinistreId, req.user.userId);
  }

  @Post('generate-situation')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  generateSituation(
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('periodStart') periodStart: string,
    @Body('periodEnd') periodEnd: string,
    @Request() req
  ) {
    return this.service.generateSituation(
      entityType,
      entityId,
      new Date(periodStart),
      new Date(periodEnd),
      req.user.userId
    );
  }

  @Post('bulk-validate')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  bulkValidate(@Body('bordereauIds') bordereauIds: string[], @Request() req) {
    return this.service.bulkValidate(bordereauIds, req.user.userId);
  }

  @Post('bulk-send')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  bulkSend(@Body('bordereauIds') bordereauIds: string[], @Body('recipients') recipients: string[], @Request() req) {
    return this.service.bulkSend(bordereauIds, recipients, req.user.userId);
  }

  @Post('bulk-generate-pdf')
  @Roles(UserRole.DIRECTEUR_FINANCIER)
  bulkGeneratePdf(@Body('bordereauIds') bordereauIds: string[], @Request() req) {
    return this.service.bulkGeneratePdf(bordereauIds, req.user.userId);
  }
}