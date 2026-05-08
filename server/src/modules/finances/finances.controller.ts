import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res, HttpCode, HttpStatus,
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
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) { return this.finances.findEncaissements({ affaireId, cedanteId, page, limit }); }

  @Post('encaissements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createEncaissement(@Body() dto: CreateEncaissementDto) {
    return this.finances.createEncaissement(dto);
  }

  // ── Décaissements ─────────────────────────────────────────────────
  @Get('decaissements')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  getDecaissements(@Query('affaireId') affaireId?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.finances.findDecaissements({ affaireId, page, limit });
  }

  @Post('decaissements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createDecaissement(@Body() dto: CreateDecaissementDto) {
    return this.finances.createDecaissement(dto);
  }

  // ── Balance ───────────────────────────────────────────────────────
  @Get('balance/:affaireId')
  @RequirePermissions(Permission.FINANCES_READ)
  getBalance(@Param('affaireId') affaireId: string) {
    return this.finances.getBalanceForAffaire(affaireId);
  }

  // ── Settlements ───────────────────────────────────────────────────
  @Get('settlements')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'situationId', required: false })
  getSettlements(@Query('affaireId') a?: string, @Query('situationId') s?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.settlements.findAll(a, s, page, limit);
  }

  @Post('settlements')
  @RequirePermissions(Permission.FINANCES_CREATE)
  createSettlement(@Body() dto: CreateSettlementDto) {
    return this.settlements.create(dto);
  }

  @Delete('settlements/:id')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  deleteSettlement(@Param('id') id: string) {
    return this.settlements.delete(id);
  }

  // ── Situations ─────────────────────────────────────────────────────
  @Get('situations')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'cedanteId', required: false })
  getSituations(@Query('cedanteId') cedanteId?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
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
  getLettrage(@Query('cedanteId') cedanteId?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.lettrage.findAll(cedanteId, page, limit);
  }

  @Get('lettrage/:id')
  @RequirePermissions(Permission.FINANCES_READ)
  getLettrageOne(@Param('id') id: string) { return this.lettrage.findOne(id); }

  @Post('lettrage')
  @RequirePermissions(Permission.FINANCES_CREATE)
  @ApiOperation({ summary: 'Lettrer des bordereaux contre un encaissement' })
  lettre(
    @Body('encaissementId') encaissementId: string,
    @Body('matches') matches: { bordereauId: string; montant: number }[],
    @Body('cedanteId') cedanteId?: string,
    @Body('reassureurCode') reassureurCode?: string,
  ) {
    return this.lettrage.lettre(encaissementId, matches, cedanteId, reassureurCode);
  }

  // ── Ordres de paiement ────────────────────────────────────────────
  @Get('ordres-paiement')
  @RequirePermissions(Permission.FINANCES_READ)
  @ApiQuery({ name: 'statut', required: false, enum: OrdreVirementStatut })
  getOrdres(@Query('statut') statut?: OrdreVirementStatut, @Query('page') page?: number, @Query('limit') limit?: number) {
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
  executeOrdre(@Param('id') id: string) { return this.ordres.markExecuted(id); }

  @Patch('ordres-paiement/:id/swift')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attacher confirmation SWIFT reçue' })
  attachSwift(@Param('id') id: string, @Body('swiftDocumentId') swiftDocumentId: string) {
    return this.ordres.attachSwift(id, swiftDocumentId);
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

  @Post('reconciliation')
  @RequirePermissions(Permission.FINANCES_CREATE)
  reconcile(
    @Body('encaissementId') encaissementId: string,
    @Body('bankMovementId') bankMovementId: string,
  ) { return this.reconciliation.reconcile(encaissementId, bankMovementId); }

  @Post('reconciliation/import')
  @RequirePermissions(Permission.FINANCES_CREATE)
  importMovements(@Body() movements: any[]) {
    return this.reconciliation.importBankMovements(movements);
  }

  // ── AML ───────────────────────────────────────────────────────────
  @Get('aml/flagged')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Transactions signalées AML (anti-blanchiment)' })
  getFlagged() { return this.aml.getFlaggedTransactions(); }
}