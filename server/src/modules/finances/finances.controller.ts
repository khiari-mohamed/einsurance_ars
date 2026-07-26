import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, UseGuards, Res,
  HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { OrdreVirementStatut } from '@prisma/client';
import { FinancesService } from './finances.service';
import { SettlementService } from './settlement.service';
import { SituationService } from './situation.service';
import { LettrageService } from './lettrage.service';
import { OrdrePaiementService } from './ordre-paiement.service';
import { FourStepPaymentService } from './four-step-payment.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { AmlService } from './aml.service';
import { CreateEncaissementDto } from './dto/create-encaissement.dto';
import { CreateDecaissementDto } from './dto/create-decaissement.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateSituationDto } from './dto/create-situation.dto';
import { CreateOrdrePaiementDto } from './dto/create-ordre-paiement.dto';
import { ApproveDecaissementDto } from './dto/approve-decaissement.dto';
import { RejectDecaissementDto } from './dto/reject-decaissement.dto';
import { CreateLettrageDto } from './dto/lettrage.dto';
import { ImportBankMovementDto } from './dto/import-bank-movement.dto';
import { ReconcileEncaissementDto, ReconcileDecaissementDto } from './dto/reconcile.dto';
import { MarkCommissionPaidDto } from './dto/mark-commission-paid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Finances')
@ApiBearerAuth()
@Controller('finances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinancesController {
  constructor(
    private finances: FinancesService,
    private settlements: SettlementService,
    private situations: SituationService,
    private lettrage: LettrageService,
    private ordres: OrdrePaiementService,
    private fourStep: FourStepPaymentService,
    private reconciliation: BankReconciliationService,
    private aml: AmlService,
  ) {}

  // ── Encaissements ─────────────────────────────────────────────────
  @Get('encaissements')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getEncaissements(
    @Query('affaireId') affaireId?: string,
    @Query('cedanteId') cedanteId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.finances.findEncaissements({ affaireId, cedanteId, page, limit }); }

  @Get('encaissements/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getEncaissement(@Param('id') id: string) { return this.finances.findEncaissement(id); }

  @Post('encaissements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createEncaissement(@Body() dto: CreateEncaissementDto) {
    return this.finances.createEncaissement(dto);
  }

  @Put('encaissements/:id')
  @RequirePermissions(Permission.FINANCES_UPDATE)
  updateEncaissement(@Param('id') id: string, @Body() dto: any) {
    return this.finances.updateEncaissement(id, dto);
  }

  @Put('encaissements/:id/validate')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  validateEncaissement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.finances.validateEncaissement(id, user.id);
  }

  @Delete('encaissements/:id')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  deleteEncaissement(@Param('id') id: string) {
    return this.finances.deleteEncaissement(id);
  }

  // ── Décaissements ─────────────────────────────────────────────────
  @Get('decaissements')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  getDecaissements(
    @Query('affaireId') affaireId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.finances.findDecaissements({ affaireId, page, limit });
  }

  @Get('decaissements/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getDecaissement(@Param('id') id: string) { return this.finances.findDecaissement(id); }

  @Post('decaissements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createDecaissement(@Body() dto: CreateDecaissementDto) {
    return this.finances.createDecaissement(dto);
  }

  @Put('decaissements/:id')
  @RequirePermissions(Permission.FINANCES_UPDATE)
  updateDecaissement(@Param('id') id: string, @Body() dto: any) {
    return this.finances.updateDecaissement(id, dto);
  }

  @Put('decaissements/:id/approve')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  approveDecaissement(@Param('id') id: string, @Body() dto: ApproveDecaissementDto, @CurrentUser() user: any) {
    return this.finances.approveDecaissement(id, dto.niveau, user.id, dto.note);
  }

  // NEW (Finances pass): complement to approve — no reject route existed.
  @Put('decaissements/:id/reject')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  rejectDecaissement(@Param('id') id: string, @Body() dto: RejectDecaissementDto, @CurrentUser() user: any) {
    return this.finances.rejectDecaissement(id, dto.motif, user.id);
  }

  @Put('decaissements/:id/execute')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  executeDecaissement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.finances.executeDecaissement(id, user.id);
  }

  @Delete('decaissements/:id')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  deleteDecaissement(@Param('id') id: string) {
    return this.finances.deleteDecaissement(id);
  }

  // ── Balance ───────────────────────────────────────────────────────
  @Get('balance/:affaireId')
  @RequirePermissions(Permission.FINANCES_READ)
  getBalance(@Param('affaireId') affaireId: string) {
    return this.finances.getBalanceForAffaire(affaireId);
  }

  // ── Commissions (read-only + mark-paid; see finances.service.ts note) ──
  @Get('commissions')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'reassureurId', required: false })
  @ApiQuery({ name: 'paid', required: false, enum: ['paid', 'unpaid'] })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getCommissions(
    @Query('affaireId') affaireId?: string,
    @Query('reassureurId') reassureurId?: string,
    @Query('paid') paid?: 'paid' | 'unpaid',
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.finances.findCommissions({ affaireId, reassureurId, paid, page, limit }); }

  @Get('commissions/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getCommission(@Param('id') id: string) { return this.finances.findCommission(id); }

  // FIX (Finances pass): POST /finances/commissions (raw AffaireReassureur
  // creation) REMOVED — see finances.service.ts for why. Commission lines
  // are created exclusively through the Affaires module.

  @Patch('commissions/:id/mark-paid')
  @RequirePermissions(Permission.FINANCES_UPDATE)
  markCommissionPaid(@Param('id') id: string, @Body() dto: MarkCommissionPaidDto, @CurrentUser() user: any) {
    return this.finances.markCommissionPaid(id, dto.decaissementId, user.id);
  }

  @Get('commissions/statement/:cedanteId/:period')
  @RequirePermissions(Permission.FINANCES_READ)
  getCommissionStatement(@Param('cedanteId') cedanteId: string, @Param('period') period: string) {
    return this.finances.getCommissionStatement(cedanteId, period);
  }

  // ── Reports ───────────────────────────────────────────────────────
  @Get('reports/cash-flow')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getCashFlowReport(@Query('startDate') startDate: string, @Query('endDate') endDate: string) {
    return this.finances.getCashFlowReport(startDate, endDate);
  }

  @Get('reports/aging')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'type', required: true, description: 'creances or dettes' })
  getAgingReport(@Query('type') type: 'creances' | 'dettes') {
    return this.finances.getAgingReport(type);
  }

  // ── Settlements ───────────────────────────────────────────────────
  @Get('settlements')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'situationId', required: false })
  getSettlements(
    @Query('affaireId') a?: string,
    @Query('situationId') s?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.settlements.findAll(a, s, page, limit);
  }

  @Get('settlements/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getSettlement(@Param('id') id: string) { return this.settlements.findOne(id); }

  @Post('settlements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createSettlement(@Body() dto: CreateSettlementDto) {
    return this.settlements.create(dto);
  }

  @Patch('settlements/:id/calculate')
  @RequirePermissions(Permission.FINANCES_UPDATE)
  @HttpCode(HttpStatus.OK)
  calculateSettlement(@Param('id') id: string) { return this.settlements.calculate(id); }

  @Patch('settlements/:id/validate')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  validateSettlement(@Param('id') id: string, @CurrentUser() user: any) { return this.settlements.validate(id, user.id); }

  @Delete('settlements/:id')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  deleteSettlement(@Param('id') id: string) {
    return this.settlements.delete(id);
  }

  // ── Situations ─────────────────────────────────────────────────────
  @Get('situations')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'cedanteId', required: false })
  getSituations(
    @Query('cedanteId') cedanteId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.situations.findAll(cedanteId, page, limit);
  }

  @Get('situations/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getSituation(@Param('id') id: string) { return this.situations.findOne(id); }

  @Post('situations')
  @RequirePermissions(Permission.FINANCES_CREATE)
  @ApiOperation({ summary: 'Compiler une situation périodique (batch netting)' })
  createSituation(@Body() dto: CreateSituationDto, @CurrentUser() user: any) {
    return this.situations.create(dto, user.id);
  }

  @Delete('situations/:id')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  deleteSituation(@Param('id') id: string) { return this.situations.delete(id); }

  // ── Lettrage ──────────────────────────────────────────────────────
  @Get('lettrage/open-items/:cedanteId')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiOperation({ summary: 'Éléments ouverts (bordereaux non lettrés) pour une cédante' })
  getOpenItems(@Param('cedanteId') cedanteId: string) {
    return this.lettrage.getOpenItems(cedanteId);
  }

  @Get('lettrage')
  @RequirePermissions(Permission.FINANCES_READ)
  getLettrage(
    @Query('cedanteId') cedanteId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.lettrage.findAll(cedanteId, page, limit); }

  @Get('lettrage/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getLettrageOne(@Param('id') id: string) { return this.lettrage.findOne(id); }

  @Post('lettrage')
  @RequirePermissions(Permission.FINANCES_CREATE)
  @ApiOperation({ summary: 'Lettrer des bordereaux contre un encaissement' })
  lettre(@Body() dto: CreateLettrageDto, @CurrentUser() user: any) {
    return this.lettrage.lettre(dto, user.id);
  }

  // ── Ordres de paiement ────────────────────────────────────────────
  @Get('ordres-paiement')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'statut', required: false, enum: OrdreVirementStatut })
  getOrdres(
    @Query('statut') statut?: OrdreVirementStatut,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.ordres.findAll(page, limit, statut);
  }

  @Get('ordres-paiement/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getOrdre(@Param('id') id: string) { return this.ordres.findOne(id); }

  @Post('ordres-paiement')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createOrdre(@Body() dto: CreateOrdrePaiementDto) { return this.ordres.create(dto); }

  @Patch('ordres-paiement/:id/validate')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  validateOrdre(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordres.validate(id, user.id);
  }

  @Patch('ordres-paiement/:id/execute')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  executeOrdre(@Param('id') id: string, @CurrentUser() user: any) { return this.ordres.markExecuted(id, user.id); }

  @Patch('ordres-paiement/:id/swift')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attacher confirmation SWIFT reçue' })
  attachSwift(@Param('id') id: string, @Body('swiftDocumentId') swiftDocumentId: string, @CurrentUser() user: any) {
    return this.ordres.attachSwift(id, swiftDocumentId, user.id);
  }

  @Get('ordres-paiement/:id/pdf')
  @RequirePermissions(Permission.FINANCES_READ)
  async downloadOrdrePdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.ordres.generatePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ordre-paiement-${id}.pdf"`);
    res.send(buffer);
  }

  // ── 4-Step payment ────────────────────────────────────────────────
  @Post('four-step/:affaireId')
  @RequirePermissions(Permission.FINANCES_CREATE)
  @ApiOperation({ summary: 'Exécuter le flux 4 étapes pour une affaire facultative' })
  fourStepPayment(@Param('affaireId') affaireId: string, @CurrentUser() user: any) {
    return this.fourStep.executeForAffaire(affaireId, user.id);
  }

  // ── Rapprochement bancaire ────────────────────────────────────────
  @Get('reconciliation/unreconciled')
  @RequirePermissions(Permission.FINANCES_READ)
  getUnreconciled() { return this.reconciliation.getUnreconciled(); }

  @Post('reconciliation/encaissement')
  @RequirePermissions(Permission.FINANCES_CREATE)
  reconcileEncaissement(@Body() dto: ReconcileEncaissementDto) {
    return this.reconciliation.reconcile(dto.encaissementId, dto.bankMovementId);
  }

  // NEW (Finances pass): Decaissement.bankMovementId existed on the schema
  // with no reconciliation route at all.
  @Post('reconciliation/decaissement')
  @RequirePermissions(Permission.FINANCES_CREATE)
  reconcileDecaissement(@Body() dto: ReconcileDecaissementDto) {
    return this.reconciliation.reconcileDecaissement(dto.decaissementId, dto.bankMovementId);
  }

  // NEW (Finances pass): no way to undo a wrong match previously existed.
  @Post('reconciliation/:bankMovementId/unreconcile')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  unreconcile(@Param('bankMovementId') bankMovementId: string) {
    return this.reconciliation.unreconcile(bankMovementId);
  }

  @Post('reconciliation/import')
  @RequirePermissions(Permission.FINANCES_CREATE)
  importMovements(@Body() movements: ImportBankMovementDto[]) {
    return this.reconciliation.importBankMovements(movements);
  }

  // ── AML ───────────────────────────────────────────────────────────
  @Get('aml/flagged')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Transactions signalées AML (anti-blanchiment)' })
  getFlagged(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ) { return this.aml.getFlaggedTransactions(page, limit); }
}