import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ComptabiliteService } from './comptabilite.service';
import { PlanComptableService } from './plan-comptable.service';
import { AuxiliaryAccountService } from './auxiliary-account.service';
import { FiscalPeriodService } from './fiscal-period.service';
import { IntegrationExportService } from './integration-export.service';
import { AccountingEngineService } from './accounting-engine.service';
import { ValidateEntryDto } from './dto/validate-entry.dto';
import { ExportEntriesDto } from './dto/export-entries.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Comptabilité')
@ApiBearerAuth()
@Controller('comptabilite')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ComptabiliteController {
  constructor(
    private service: ComptabiliteService,
    private planComptable: PlanComptableService,
    private auxiliary: AuxiliaryAccountService,
    private fiscalPeriod: FiscalPeriodService,
    private exportService: IntegrationExportService,
    private engine: AccountingEngineService,
  ) {}

  // ── Journal entries ───────────────────────────────────────────────
  @Get('entries')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'fiscalPeriodId', required: false })
  @ApiQuery({ name: 'page', required: false })
  findEntries(
    @Query('statut') statut?: string,
    @Query('type') type?: string,
    @Query('affaireId') affaireId?: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) { return this.service.findEntries({ statut, type, affaireId, fiscalPeriodId, page, limit }); }

  @Get('entries/:id')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch('entries/validate')
  @RequirePermissions(Permission.COMPTABILITE_VALIDATE)
  @ApiOperation({ summary: 'Valider des écritures (BROUILLON → VALIDE)' })
  validate(@Body() dto: ValidateEntryDto, @CurrentUser() user: any) {
    return this.service.validate(dto.entryIds, user.id);
  }

  // ── Auto-generate entries ─────────────────────────────────────────
  @Post('entries/generate/facultative/:affaireId')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  @ApiOperation({ summary: 'Générer écriture passation CA facultative' })
  generateFac(@Param('affaireId') affaireId: string) {
    return this.engine.generateForFacultativeAffaire(affaireId);
  }

  @Post('entries/generate/encaissement/:id')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  generateEncaissement(@Param('id') id: string) {
    return this.engine.generateForEncaissement(id);
  }

  @Post('entries/generate/decaissement/:id')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  generateDecaissement(@Param('id') id: string) {
    return this.engine.generateForDecaissement(id);
  }

  // ── Ledger / Grand livre ──────────────────────────────────────────
  @Get('ledger')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiOperation({ summary: 'Grand livre par compte' })
  @ApiQuery({ name: 'compte', required: false })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'reassureurId', required: false })
  @ApiQuery({ name: 'year', required: false })
  getLedger(
    @Query('compte') compte?: string,
    @Query('cedanteId') cedanteId?: string,
    @Query('reassureurId') reassureurId?: string,
    @Query('year') year?: number,
  ) { return this.service.getLedger(compte, cedanteId, reassureurId, year); }

  @Get('trial-balance')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiOperation({ summary: 'Balance de vérification' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'mois', required: false })
  getTrialBalance(@Query('year') year?: number, @Query('mois') mois?: number) {
    return this.service.getTrialBalance(year, mois);
  }

  // ── Plan comptable ────────────────────────────────────────────────
  @Get('plan-comptable')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'search', required: false })
  getPlanComptable(@Query('search') search?: string) { return this.planComptable.findAll(search); }

  @Post('plan-comptable')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  createAccount(@Body() data: any) { return this.planComptable.create(data); }

  @Post('plan-comptable/seed')
  @RequirePermissions(Permission.SYSTEM_UPDATE)
  @ApiOperation({ summary: 'Initialiser le plan comptable ARS standard' })
  seedPlanComptable() { return this.planComptable.seed(); }

  // ── Auxiliary accounts ────────────────────────────────────────────
  @Get('auxiliary-accounts')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  @ApiQuery({ name: 'planComptableId', required: false })
  getAuxiliaries(@Query('planComptableId') planComptableId?: string) {
    return this.auxiliary.findAll(planComptableId);
  }

  @Post('auxiliary-accounts')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  createAuxiliary(@Body() data: any) { return this.auxiliary.create(data); }

  // ── Fiscal periods ────────────────────────────────────────────────
  @Get('fiscal-periods')
  @RequirePermissions(Permission.COMPTABILITE_READ)
  getPeriods() { return this.fiscalPeriod.findAll(); }

  @Post('fiscal-periods/init/:year')
  @RequirePermissions(Permission.COMPTABILITE_CREATE)
  @ApiOperation({ summary: 'Initialiser les 12 périodes d\'un exercice' })
  initYear(@Param('year') year: number) { return this.fiscalPeriod.initYear(year); }

  @Patch('fiscal-periods/close')
  @RequirePermissions(Permission.COMPTABILITE_VALIDATE)
  @ApiOperation({ summary: 'Clôturer une période comptable' })
  closePeriod(@Body() dto: ClosePeriodDto, @CurrentUser() user: any) {
    return this.fiscalPeriod.close(dto, user.id);
  }

  // ── Export ────────────────────────────────────────────────────────
  @Post('export')
  @RequirePermissions(Permission.COMPTABILITE_EXPORT)
  @ApiOperation({ summary: 'Exporter les écritures validées (EXCEL ou TXT)' })
  async exportEntries(@Body() dto: ExportEntriesDto, @CurrentUser() user: any, @Res() res: Response) {
    const { buffer, fileName } = await this.exportService.export(
      dto.format, dto.dateFrom, dto.dateTo, dto.entryIds, user.id,
    );
    const contentType = dto.format === 'EXCEL'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/plain';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}