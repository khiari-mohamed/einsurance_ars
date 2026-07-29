import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards, DefaultValuePipe, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { JournalEntryStatut } from '@prisma/client';
import { ComptabiliteService } from './comptabilite.service';
import { AccountingEngineService } from './accounting-engine.service';
import { PlanComptableService } from './plan-comptable.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { ValidateEntryDto } from './dto/validate-entry.dto';
import { ExportEntriesDto } from './dto/export-entries.dto';
import { GenerateExportDto } from './dto/generate-export.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { IntegrationExportService } from './integration-export.service';
import { CreatePlanComptableDto } from './dto/create-plan-comptable.dto';
import { UpdatePlanComptableDto } from './dto/update-plan-comptable.dto';
import { CreateAuxiliaryAccountDto } from './dto/create-auxiliary-account.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

// NOTE on scope: no Bilan (Balance Sheet, actif/passif) endpoint exists
// here, deliberately. The CDC's "Fenêtres de l'application" diagram lists
// exactly two things under Comptabilité — génération de l'écriture
// comptable + fichier d'intégration — and the accompanying text describes
// the statutory/actif-passif accounting as living in ARS's separate
// accounting software, fed by this module's export (getExport below). A
// Bilan built off a 10-account seed chart with no full balance-sheet
// structure (immobilisations, capitaux propres, etc.) would be a fabricated
// deliverable the data can't honestly support. getProfitLoss() (compte de
// résultat, classes 6/7) IS implemented, since it's a direct, honest
// derivative of the validated trial balance and is CDC-adjacent.
@ApiTags('Comptabilité')
@ApiBearerAuth()
@Controller('comptabilite')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ComptabiliteController {
  constructor(
    private service: ComptabiliteService,
    private engine: AccountingEngineService,
    private planComptable: PlanComptableService,
    private auxiliary: AuxiliaryAccountService,
    private fiscalPeriod: FiscalPeriodService,
    private integrationExport: IntegrationExportService,
  ) {}

  // ── Journal entries ─────────────────────────────────────────────
  @Get('entries')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'statut', required: false, enum: JournalEntryStatut })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'fiscalPeriodId', required: false })
  getEntries(
    @Query('statut') statut?: JournalEntryStatut,
    @Query('type') type?: string,
    @Query('affaireId') affaireId?: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.service.findAll({ statut, type, affaireId, fiscalPeriodId, page, limit }); }

  @Get('entries/:id')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getEntry(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch('entries/:id/validate')
  @RequirePermissions(Permission.COMPTABILITE_VALIDATE)
  @HttpCode(HttpStatus.OK)
  validateEntry(@Param('id') id: string, @Body() dto: ValidateEntryDto, @CurrentUser() user: any) {
    return this.service.validate(id, dto, user.id);
  }

  @Delete('entries/:id')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  deleteEntry(@Param('id') id: string) { return this.service.delete(id); }

  // ── Generation ────────────────────────────────────────────────────
  @Post('generate/facultative/:affaireId')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  @ApiOperation({ summary: 'Générer l\'écriture de passation CA facultative' })
  generateFacultative(@Param('affaireId') affaireId: string) {
    return this.engine.generateForFacultativeAffaire(affaireId).then((id) => this.service.findOne(id));
  }

  @Post('generate/traite-situation/:situationId')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  @ApiOperation({ summary: 'Générer l\'écriture de passation CA traité (par situation compilée)' })
  generateTraite(@Param('situationId') situationId: string) {
    return this.engine.generateForTraiteSituation(situationId).then((id) => this.service.findOne(id));
  }

  @Post('generate/encaissement/:encaissementId')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  generateEncaissement(@Param('encaissementId') encaissementId: string) {
    return this.engine.generateForEncaissement(encaissementId).then((id) => this.service.findOne(id));
  }

  @Post('generate/decaissement/:decaissementId')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  generateDecaissement(@Param('decaissementId') decaissementId: string) {
    return this.engine.generateForDecaissement(decaissementId).then((id) => this.service.findOne(id));
  }

  // ── Ledger / reports ──────────────────────────────────────────────
  @Get('ledger')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'compte', required: false, description: 'Préfixe de compte, ex: 401, 411, 532' })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'reassureurId', required: false })
  @ApiQuery({ name: 'year', required: false })
  getLedger(
    @Query('compte') compte?: string,
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurId') reassureurId?: string,
    @Query('year') year?: string,
  ) { return this.service.getLedger({ compte, cedanteId, reassureurId, year: year ? Number(year) : undefined }); }

  @Get('trial-balance')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getTrialBalance(@Query('year') year?: string, @Query('mois') mois?: string) {
    return this.service.getTrialBalance(year ? Number(year) : undefined, mois ? Number(mois) : undefined);
  }

  @Get('profit-loss')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getProfitLoss(@Query('year') year?: string) {
    return this.service.getProfitLoss(year ? Number(year) : undefined);
  }

  @Post('export')
  @RequirePermissions(Permission.COMPTABILITE_EXPORT)
  exportEntries(@Body() dto: ExportEntriesDto) { return this.service.exportEntries(dto); }

  // ── Integration export (real, stateful — see integration-export.service.ts) ──
  @Post('integration-export')
  @RequirePermissions(Permission.COMPTABILITE_EXPORT)
  generateIntegrationExport(@Body() dto: GenerateExportDto, @CurrentUser() user: any) {
    return this.integrationExport.generate(dto, user.id);
  }

  @Get('integration-export/batches')
  @RequirePermissions(Permission.COMPTABILITE_EXPORT)
  listExportBatches(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) { return this.integrationExport.listBatches(page, limit); }

  @Get('integration-export/batches/:id')
  @RequirePermissions(Permission.COMPTABILITE_EXPORT)
  getExportBatch(@Param('id') id: string) { return this.integrationExport.getBatch(id); }

  @Post('integration-export/batches/:id/void')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  voidExportBatch(@Param('id') id: string, @CurrentUser() user: any) {
    return this.integrationExport.voidBatch(id, user.id);
  }

  // ── Plan comptable ────────────────────────────────────────────────
  @Get('plan-comptable')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'classe', required: false })
  getPlanComptable(@Query('search') search?: string, @Query('classe') classe?: string) {
    return this.planComptable.findAll(search, classe);
  }

  @Get('plan-comptable/:id')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getPlanComptableOne(@Param('id') id: string) { return this.planComptable.findOne(id); }

  @Post('plan-comptable')
  @RequirePermissions(Permission.SUPER_ADMIN)
  createPlanComptable(@Body() dto: CreatePlanComptableDto) { return this.planComptable.create(dto); }

  @Put('plan-comptable/:id')
  @RequirePermissions(Permission.SUPER_ADMIN)
  updatePlanComptable(@Param('id') id: string, @Body() dto: UpdatePlanComptableDto) {
    return this.planComptable.update(id, dto);
  }

  @Delete('plan-comptable/:id')
  @RequirePermissions(Permission.SUPER_ADMIN)
  deletePlanComptable(@Param('id') id: string) { return this.planComptable.deactivate(id); }

  @Post('plan-comptable/seed')
  @RequirePermissions(Permission.SUPER_ADMIN)
  seedPlanComptable() { return this.planComptable.seed(); }

  // ── Auxiliary accounts ────────────────────────────────────────────
  @Get('auxiliary-accounts')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getAuxiliaryAccounts(@Query('planComptableId') planComptableId?: string) {
    return this.auxiliary.findAll(planComptableId);
  }

  @Post('auxiliary-accounts')
  @RequirePermissions(Permission.SUPER_ADMIN)
  createAuxiliaryAccount(@Body() dto: CreateAuxiliaryAccountDto) { return this.auxiliary.create(dto); }

  // ── Fiscal periods ────────────────────────────────────────────────
  @Get('fiscal-periods')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getFiscalPeriods() { return this.fiscalPeriod.findAll(); }

  @Get('fiscal-periods/current')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getCurrentPeriod() { return this.fiscalPeriod.getCurrent(); }

  @Post('fiscal-periods/init/:year')
  @RequirePermissions(Permission.SUPER_ADMIN)
  initYear(@Param('year') year: string) { return this.fiscalPeriod.initYear(Number(year)); }

  @Patch('fiscal-periods/close')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  closePeriod(@Body() dto: ClosePeriodDto, @CurrentUser() user: any) { return this.fiscalPeriod.close(dto, user.id); }

  @Patch('fiscal-periods/reopen')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  reopenPeriod(@Body() dto: ClosePeriodDto, @CurrentUser() user: any) { return this.fiscalPeriod.reopen(dto, user.id); }
}