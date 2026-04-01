import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SinistresService } from './sinistres.service';
import { SinistreDocumentService } from './sinistre-document.service';
import { SinistreAnalyticsService } from './sinistre-analytics.service';
import { SinistreBordereauService } from './sinistre-bordereau.service';
import { SinistreAuditService } from './sinistre-audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/users.entity';
import { CreateSinistreDto } from './dto/create-sinistre.dto';
import { UpdateSinistreDto } from './dto/update-sinistre.dto';
import { UpdateParticipationDto } from './dto/update-participation.dto';
import { CreateExpertiseDto } from './dto/create-expertise.dto';
import { AdjustSAPDto } from './dto/adjust-sap.dto';

@Controller('sinistres')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SinistresController {
  constructor(
    private service: SinistresService,
    private documentService: SinistreDocumentService,
    private analyticsService: SinistreAnalyticsService,
    private bordereauService: SinistreBordereauService,
    private auditService: SinistreAuditService,
  ) {}

  @Get()
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  findAll(@Query() filters: any) {
    return this.service.findAll(filters);
  }

  @Get('dashboard/stats')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getDashboardStats() {
    return this.service.getDashboardStats();
  }

  @Get('analytics/evolution')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getEvolution(@Query('months') months?: number) {
    return this.analyticsService.getEvolution(months ? parseInt(months as any) : 12);
  }

  @Get('analytics/by-cedante')
  getByCedante() {
    return this.analyticsService.getByCedante();
  }

  @Get('analytics/by-status')
  getByStatus() {
    return this.analyticsService.getByStatus();
  }

  @Get('analytics/aging')
  getAging() {
    return this.analyticsService.getAging();
  }

  @Get('analytics/sap-summary')
  getSAPAnalysis() {
    return this.analyticsService.getSAPAnalysis();
  }

  @Post()
  @Roles(UserRole.TECHNICIEN_SINISTRES)
  create(@Body() dto: CreateSinistreDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  @Put('participations/:id')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.TECHNICIEN_SINISTRES)
  updateParticipation(@Param('id') id: string, @Body() dto: UpdateParticipationDto) {
    return this.service.updateParticipation(id, dto);
  }

  @Post('expertises')
  @Roles(UserRole.TECHNICIEN_SINISTRES)
  createExpertise(@Body() dto: CreateExpertiseDto) {
    return this.service.createExpertise(dto);
  }

  @Post('sap/adjust')
  async adjustSAP(@Body() dto: AdjustSAPDto, @Req() req: any) {
    const before = await this.service.findOne(dto.sinistreId);
    const result = await this.service.adjustSAP(dto, req.user.id);
    const after = await this.service.findOne(dto.sinistreId);
    
    await this.auditService.log({
      entityType: 'SAP',
      entityId: dto.sinistreId,
      action: 'SAP_ADJUSTMENT',
      userId: req.user.id,
      before: { sapActuel: before.sapActuel },
      after: { sapActuel: after.sapActuel },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    
    return result;
  }

  @Get('documents/:docId/url')
  getDocumentUrl(@Param('docId') docId: string) {
    return this.documentService.getDocumentUrl(docId);
  }

  @Delete('documents/:docId')
  deleteDocument(@Param('docId') docId: string) {
    return this.documentService.deleteDocument(docId);
  }

  @Post('bordereaux/generate')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.DIRECTEUR_GENERAL)
  generateBordereau(@Body() data: any) {
    return this.bordereauService.generateBordereauSinistres({
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reassureurId: data.reassureurId,
      cedanteId: data.cedanteId,
    });
  }

  @Post('bordereaux/generate-pdf')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.DIRECTEUR_GENERAL)
  generateBordereauWithPDF(@Body() data: any) {
    return this.bordereauService.generateBordereauWithPDF({
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      reassureurId: data.reassureurId,
      cedanteId: data.cedanteId,
    });
  }

  @Get(':id/documents')
  getDocuments(@Param('id') id: string) {
    return this.documentService.findBySinistre(id);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    return this.documentService.uploadDocument({
      sinistreId: id,
      type: body.type,
      nom: body.nom || file.originalname,
      file,
      tags: body.tags ? JSON.parse(body.tags) : [],
      description: body.description,
      uploadedById: req.user.id,
    });
  }

  @Post(':id/notify-reinsurers')
  @Roles(UserRole.TECHNICIEN_SINISTRES)
  notifyReinsurers(@Param('id') id: string) {
    return this.service.notifyReinsurers(id);
  }

  @Get(':id/audit-trail')
  getAuditTrail(@Param('id') id: string) {
    return this.auditService.getAuditTrail('SINISTRE', id);
  }

  @Get('suivi')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getSuivi(@Query() filters: any) {
    return this.service.findAll(filters);
  }

  @Get('reserves')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  getReserves(@Query() filters: any) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @Roles(UserRole.TECHNICIEN_SINISTRES, UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_GENERAL)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Roles(UserRole.TECHNICIEN_SINISTRES)
  async update(@Param('id') id: string, @Body() dto: UpdateSinistreDto, @Req() req: any) {
    const result = await this.service.update(id, dto, req.user.id);
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.DIRECTEUR_GENERAL)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
