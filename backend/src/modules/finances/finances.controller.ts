import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Patch } from '@nestjs/common';
import { FinancesService } from './finances.service';
import { LettrageService } from './lettrage.service';
import { SettlementService } from './settlement.service';
import { CommissionService } from './commission.service';
import { AccountingService } from './accounting.service';
import { AMLService } from './aml.service';
import { TaxService } from './tax.service';
import { BankReconciliationService } from './bank-reconciliation.service';
import { OrdrePaiementService } from './ordre-paiement.service';
import { FourStepPaymentService, FourStepPaymentDto } from './four-step-payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../users/users.entity';
import { CreateEncaissementDto } from './dto/create-encaissement.dto';
import { UpdateEncaissementDto } from './dto/update-encaissement.dto';
import { CreateDecaissementDto } from './dto/create-decaissement.dto';
import { UpdateDecaissementDto } from './dto/update-decaissement.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { CreateOrdrePaiementDto } from './dto/create-ordre-paiement.dto';
import { EncaissementStatus } from './encaissement.entity';
import { DecaissementStatus } from './decaissement.entity';
import { PaymentOrderStatus } from './ordre-paiement.entity';

@Controller('finances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancesController {
  constructor(
    private readonly financesService: FinancesService,
    private readonly lettrageService: LettrageService,
    private readonly settlementService: SettlementService,
    private readonly commissionService: CommissionService,
    private readonly accountingService: AccountingService,
    private readonly amlService: AMLService,
    private readonly taxService: TaxService,
    private readonly bankReconciliationService: BankReconciliationService,
    private readonly ordrePaiementService: OrdrePaiementService,
    private readonly fourStepPaymentService: FourStepPaymentService,
  ) {}

  // ==================== ENCAISSEMENTS ====================

  @Post('encaissements')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.COMPTABLE, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  createEncaissement(@Body() dto: CreateEncaissementDto, @Request() req) {
    return this.financesService.createEncaissement(dto, req.user.userId);
  }

  @Get('encaissements')
  findAllEncaissements(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sourceType') sourceType?: string,
    @Query('statut') statut?: EncaissementStatus,
    @Query('affaireId') affaireId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financesService.findAllEncaissements({
      startDate,
      endDate,
      sourceType,
      statut,
      affaireId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('encaissements/:id')
  findOneEncaissement(@Param('id') id: string) {
    return this.financesService.findOneEncaissement(id);
  }

  @Put('encaissements/:id')
  updateEncaissement(
    @Param('id') id: string,
    @Body() dto: UpdateEncaissementDto,
    @Request() req,
  ) {
    return this.financesService.updateEncaissement(id, dto, req.user.userId);
  }

  @Put('encaissements/:id/validate')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  validateEncaissement(@Param('id') id: string, @Request() req) {
    return this.financesService.validateEncaissement(id, req.user.userId);
  }

  @Put('encaissements/:id/comptabilize')
  @Roles(UserRole.COMPTABLE, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  comptabilizeEncaissement(
    @Param('id') id: string,
    @Body('pieceComptable') pieceComptable: string,
    @Request() req,
  ) {
    return this.financesService.comptabilizeEncaissement(id, pieceComptable, req.user.userId);
  }

  @Delete('encaissements/:id')
  deleteEncaissement(@Param('id') id: string) {
    return this.financesService.deleteEncaissement(id);
  }

  // ==================== DECAISSEMENTS ====================

  @Post('decaissements')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  createDecaissement(@Body() dto: CreateDecaissementDto, @Request() req) {
    return this.financesService.createDecaissement(dto, req.user.userId);
  }

  @Get('decaissements')
  findAllDecaissements(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('beneficiaireType') beneficiaireType?: string,
    @Query('statut') statut?: DecaissementStatus,
    @Query('affaireId') affaireId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.financesService.findAllDecaissements({
      startDate,
      endDate,
      beneficiaireType,
      statut,
      affaireId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('decaissements/:id')
  findOneDecaissement(@Param('id') id: string) {
    return this.financesService.findOneDecaissement(id);
  }

  @Put('decaissements/:id')
  updateDecaissement(
    @Param('id') id: string,
    @Body() dto: UpdateDecaissementDto,
    @Request() req,
  ) {
    return this.financesService.updateDecaissement(id, dto, req.user.userId);
  }

  @Put('decaissements/:id/approve')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  approveDecaissement(
    @Param('id') id: string,
    @Body('niveau') niveau: number,
    @Body('commentaire') commentaire: string,
    @Request() req,
  ) {
    return this.financesService.approveDecaissement(id, niveau, req.user.userId, commentaire);
  }

  @Put('decaissements/:id/ordonnancer')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  ordonnancerDecaissement(@Param('id') id: string, @Request() req) {
    return this.financesService.ordonnancerDecaissement(id, req.user.userId);
  }

  @Put('decaissements/:id/execute')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeDecaissement(@Param('id') id: string, @Request() req) {
    return this.financesService.executeDecaissement(id, req.user.userId);
  }

  @Delete('decaissements/:id')
  deleteDecaissement(@Param('id') id: string) {
    return this.financesService.deleteDecaissement(id);
  }

  // ==================== BANK MOVEMENTS ====================

  @Get('bank-movements')
  findAllBankMovements(@Query('compteBancaire') compteBancaire?: string) {
    return this.financesService.findAllBankMovements(compteBancaire);
  }

  // ==================== LETTRAGE ====================

  @Post('lettrage/auto')
  autoLettrage() {
    return this.lettrageService.autoLettrageAdvanced();
  }

  @Get('lettrage')
  findAllLettrage(
    @Query('type') type?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.lettrageService.findAll({ type: type as any, entityId });
  }

  @Get('lettrage/:id')
  findOneLettrage(@Param('id') id: string) {
    return this.lettrageService.findOne(id);
  }

  @Get('lettrage/aging/:type')
  getAgingAnalysis(@Param('type') type: 'creances' | 'dettes', @Query('cedanteId') cedanteId?: string) {
    return this.lettrageService.getAgingAnalysis(type, cedanteId);
  }

  @Get('lettrage/unmatched/items')
  getUnmatchedItems(
    @Query('days') days?: number,
    @Query('minMontant') minMontant?: number,
  ) {
    return this.lettrageService.getUnmatchedItems(days, minMontant);
  }

  // ==================== SETTLEMENTS ====================

  @Post('settlements')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  createSettlement(@Body() dto: CreateSettlementDto, @Request() req) {
    return this.settlementService.createSettlement(dto, req.user.userId);
  }

  @Get('settlements')
  findAllSettlements(
    @Query('cedanteId') cedanteId?: string,
    @Query('statut') statut?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.settlementService.findAllSettlements({ cedanteId, statut: statut as any, startDate, endDate });
  }

  @Get('settlements/:id')
  findOneSettlement(@Param('id') id: string) {
    return this.settlementService.findOneSettlement(id);
  }

  @Patch('settlements/:id/calculate')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  calculateSettlement(@Param('id') id: string, @Request() req) {
    return this.settlementService.calculateSettlement(id, req.user.userId);
  }

  @Patch('settlements/:id/validate')
  validateSettlement(@Param('id') id: string, @Request() req) {
    return this.settlementService.validateSettlement(id, req.user.userId);
  }

  // ==================== COMMISSIONS ====================

  @Post('commissions')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  createCommission(@Body() dto: CreateCommissionDto, @Request() req) {
    return this.commissionService.createCommission(dto, req.user.userId);
  }

  @Get('commissions')
  findAllCommissions(
    @Query('affaireId') affaireId?: string,
    @Query('type') type?: string,
    @Query('statut') statut?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.commissionService.findAllCommissions({ affaireId, type: type as any, statut: statut as any, startDate, endDate });
  }

  @Get('commissions/:id')
  findOneCommission(@Param('id') id: string) {
    return this.commissionService.findOneCommission(id);
  }

  @Patch('commissions/:id/mark-paid')
  markCommissionAsPaid(
    @Param('id') id: string,
    @Body('decaissementId') decaissementId: string,
    @Request() req,
  ) {
    return this.commissionService.markAsPaid(id, decaissementId, req.user.userId);
  }

  @Get('commissions/statement/:cedanteId/:period')
  getCommissionStatement(@Param('cedanteId') cedanteId: string, @Param('period') period: string) {
    return this.commissionService.getCommissionStatement(cedanteId, period);
  }

  // ==================== ACCOUNTING ENTRIES ====================

  @Get('accounting')
  @Roles(UserRole.COMPTABLE, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  findAllAccountingEntries(
    @Query('journalCode') journalCode?: string,
    @Query('compteDebit') compteDebit?: string,
    @Query('statut') statut?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.findAllEntries({ journalCode: journalCode as any, compteDebit, statut: statut as any, startDate, endDate });
  }

  @Get('accounting/:id')
  async findOneAccountingEntry(@Param('id') id: string) {
    const result = await this.accountingService.findAllEntries({ compteDebit: id });
    return result.data;
  }

  @Patch('accounting/:id/validate')
  @Roles(UserRole.COMPTABLE, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  validateAccountingEntry(@Param('id') id: string, @Request() req) {
    return this.accountingService.validateEntry(id, req.user.userId);
  }

  @Patch('accounting/:id/comptabilize')
  comptabilizeAccountingEntry(@Param('id') id: string, @Request() req) {
    return this.accountingService.comptabilizeEntry(id, req.user.userId);
  }

  @Get('accounting/trial-balance/:period')
  getTrialBalance(@Param('period') period: string) {
    return this.accountingService.getTrialBalance(period, period);
  }

  // ==================== AML SCREENING ====================

  @Post('aml/screen')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  screenPayment(
    @Body('encaissementId') encaissementId?: string,
    @Body('decaissementId') decaissementId?: string,
  ) {
    return this.amlService.screenPayment(encaissementId, decaissementId);
  }

  @Get('aml/report/:startDate/:endDate')
  getAMLReport(@Param('startDate') startDate: string, @Param('endDate') endDate: string) {
    return this.amlService.generateAMLReport(startDate, endDate);
  }

  // ==================== TAX CALCULATIONS ====================

  @Get('tax/obligation/:startDate/:endDate/:type')
  getTaxObligation(
    @Param('startDate') startDate: string,
    @Param('endDate') endDate: string,
    @Param('type') type: string,
  ) {
    return this.taxService.getCommissionTaxObligation(startDate, endDate, type as any);
  }

  @Get('tax/withholding/:period')
  getWithholdingTaxReport(@Param('period') period: string) {
    return this.taxService.getWithholdingTaxReport(period, period);
  }

  @Get('tax/deductions/:year')
  getTaxDeductions(@Param('year') year: string) {
    return this.taxService.getTaxDeductions(Number(year));
  }

  @Get('tax/compliance')
  getTaxComplianceStatus() {
    return this.taxService.getTaxComplianceStatus();
  }

  // ==================== BANK RECONCILIATION ====================

  @Post('bank-reconciliation/import')
  @Roles(UserRole.COMPTABLE, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  importBankStatement(
    @Body('compteBancaire') compteBancaire: string,
    @Body('statement') statement: any[],
    @Request() req,
  ) {
    return this.bankReconciliationService.importBankStatement(compteBancaire, statement, req.user.userId);
  }

  @Patch('bank-reconciliation/reconcile')
  reconcileAccount(
    @Body('compteBancaire') compteBancaire: string,
    @Body('soldeBank') soldeBank: string,
    @Request() req,
  ) {
    return this.bankReconciliationService.reconcileAccount(compteBancaire, soldeBank, req.user.userId);
  }

  @Get('bank-reconciliation/unreconciled/:compteBancaire')
  getUnreconciledReport(@Param('compteBancaire') compteBancaire: string) {
    return this.bankReconciliationService.getUnreconciledReport(compteBancaire);
  }

  @Get('bank-reconciliation/history/:compteBancaire')
  getReconciliationHistory(@Param('compteBancaire') compteBancaire: string) {
    return this.bankReconciliationService.getReconciliationHistory(compteBancaire);
  }

  // ==================== REPORTS ====================

  @Get('reports/cash-flow')
  getCashFlowReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financesService.getCashFlowReport(startDate, endDate);
  }

  @Get('reports/aging')
  getAgingReport(@Query('type') type: 'creances' | 'dettes') {
    return this.financesService.getAgingReport(type);
  }

  // ==================== ORDRES DE PAIEMENT ====================

  @Post('ordres-paiement')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  createOrdrePaiement(@Body() dto: CreateOrdrePaiementDto, @Request() req) {
    return this.ordrePaiementService.create(dto, req.user.userId);
  }

  @Get('ordres-paiement')
  findAllOrdresPaiement(@Query('statut') statut?: PaymentOrderStatus) {
    return this.ordrePaiementService.findAll({ statut });
  }

  @Get('ordres-paiement/:id')
  findOneOrdrePaiement(@Param('id') id: string) {
    return this.ordrePaiementService.findOne(id);
  }

  @Patch('ordres-paiement/:id/verify')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  verifyOrdrePaiement(@Param('id') id: string, @Request() req) {
    return this.ordrePaiementService.verify(id, req.user.userId);
  }

  @Patch('ordres-paiement/:id/sign')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  signOrdrePaiement(
    @Param('id') id: string,
    @Body('commentaire') commentaire: string,
    @Request() req,
  ) {
    return this.ordrePaiementService.sign(id, req.user.userId, commentaire);
  }

  @Patch('ordres-paiement/:id/transmit')
  @Roles(UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  transmitOrdrePaiement(
    @Param('id') id: string,
    @Body('referenceBank') referenceBank: string,
    @Request() req,
  ) {
    return this.ordrePaiementService.transmit(id, req.user.userId, referenceBank);
  }

  // ==================== FOUR-STEP PAYMENT WIZARD ====================

  @Post('four-step-payment/step1')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeStep1(
    @Body() body: { affaireId: string; montant: number; dateEncaissement: Date; referencePaiement: string; modePaiement: string },
    @Request() req
  ) {
    return this.fourStepPaymentService.executeStep1(body.affaireId, body, req.user.userId);
  }

  @Post('four-step-payment/step2')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeStep2(
    @Body() body: { affaireId: string; montant: number; dateDecaissement: Date; referencePaiement: string; modePaiement: string },
    @Request() req
  ) {
    return this.fourStepPaymentService.executeStep2(body.affaireId, body, req.user.userId);
  }

  @Post('four-step-payment/step3')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeStep3(
    @Body() body: { affaireId: string; montant: number; dateEncaissement: Date; referencePaiement: string; modePaiement: string },
    @Request() req
  ) {
    return this.fourStepPaymentService.executeStep3(body.affaireId, body, req.user.userId);
  }

  @Post('four-step-payment/step4')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeStep4(
    @Body() body: { affaireId: string; payments: any[] },
    @Request() req
  ) {
    return this.fourStepPaymentService.executeStep4(body.affaireId, body, req.user.userId);
  }

  @Post('four-step-payment/complete')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  executeFourStepFlow(@Body() dto: FourStepPaymentDto, @Request() req) {
    return this.fourStepPaymentService.executeFourStepFlow(dto, req.user.userId);
  }

  // ==================== SWIFT CONFIRMATION ====================

  @Post('decaissements/:id/swift-upload')
  @Roles(UserRole.AGENT_FINANCIER, UserRole.DIRECTEUR_FINANCIER, UserRole.ADMINISTRATEUR)
  async uploadSwiftConfirmation(
    @Param('id') id: string,
    @Body('swiftDocumentUrl') swiftDocumentUrl: string,
    @Request() req
  ) {
    return this.financesService.attachSwiftConfirmation(id, swiftDocumentUrl, req.user.userId);
  }
}
