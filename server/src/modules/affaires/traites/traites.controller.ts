import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { AffaireStatut, Periodicite } from '@prisma/client';
import { TraitesService } from './traites.service';
import {
  CreateTraiteDto,
  TreatyAccountRubriqueDto,
} from './dto/create-traite.dto';
import { UpdateTraiteDto } from './dto/update-traite.dto';
import { LiquidationInput } from './treaty-calculator.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Traités')
@ApiBearerAuth()
@Controller('traites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TraitesController {
  constructor(private readonly service: TraitesService) {}

  @Get()
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Liste tous les traités de réassurance' })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'reassuranceType', required: false })
  @ApiQuery({ name: 'periodicite', required: false, enum: Periodicite })
  @ApiQuery({ name: 'statut', required: false, enum: AffaireStatut })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('cedanteId') cedanteId?: string,
    @Query('reassuranceType') reassuranceType?: string,
    @Query('periodicite') periodicite?: Periodicite,
    @Query('statut') statut?: AffaireStatut,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({
      cedanteId,
      reassuranceType,
      periodicite,
      statut,
      search,
      page,
      limit,
    });
  }

  @Get('renewals-alert')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Traités arrivant à échéance prochainement' })
  @ApiQuery({ name: 'daysAhead', required: false })
  getRenewalsAlert(@Query('daysAhead') daysAhead?: number) {
    return this.service.getRenewalsAlert(
      daysAhead ? Number(daysAhead) : 60,
    );
  }

  @Get('stats')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiOperation({ summary: 'Statistiques globales des traités' })
  @ApiQuery({ name: 'year', required: false })
  getStats(@Query('year') year?: number) {
    return this.service.getStats(year ? Number(year) : undefined);
  }

  @Get(':affaireId')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: "Détail complet d'un traité" })
  findOne(@Param('affaireId') affaireId: string) {
    return this.service.findOne(affaireId);
  }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_CREATE)
  @ApiOperation({ summary: "Créer les données d'un traité sur une affaire existante" })
  create(@Body() dto: CreateTraiteDto) {
    return this.service.create(dto);
  }

  @Put(':affaireId')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: "Mettre à jour les données du traité" })
  update(
    @Param('affaireId') affaireId: string,
    @Body() dto: UpdateTraiteDto,
  ) {
    return this.service.update(affaireId, dto);
  }

  // ── Account Rubriques ────────────────────────────────────────────

  @Put(':affaireId/account-rubriques')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Remplacer les rubriques de compte du traité' })
  replaceAccountRubriques(
    @Param('affaireId') affaireId: string,
    @Body() rubriques: TreatyAccountRubriqueDto[],
  ) {
    return this.service.replaceAccountRubriques(affaireId, rubriques);
  }

  // ── PMD Instalments ──────────────────────────────────────────────

  @Get(':affaireId/pmd-instalments')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Calendrier de versement PMD' })
  getPmdInstalments(@Param('affaireId') affaireId: string) {
    return this.service.getPmdInstalments(affaireId);
  }

  @Post(':affaireId/pmd-instalments/regenerate')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Régénérer le calendrier PMD depuis le PMD et la périodicité' })
  @HttpCode(HttpStatus.OK)
  regeneratePmdInstalments(@Param('affaireId') affaireId: string) {
    return this.service.regeneratePmdInstalments(affaireId);
  }

  @Patch(':affaireId/pmd-instalments/:instalmentId/pay')
  @RequirePermissions(Permission.FINANCES_CREATE)
  @ApiOperation({ summary: 'Marquer une tranche PMD comme payée' })
  @HttpCode(HttpStatus.OK)
  markInstalmentPaid(
    @Param('affaireId') affaireId: string,
    @Param('instalmentId') instalmentId: string,
  ) {
    return this.service.markInstalmentPaid(affaireId, instalmentId);
  }

  // ── Calculations ─────────────────────────────────────────────────

  @Post(':affaireId/calculate-liquidation')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Calculer le compte de liquidation du traité' })
  @HttpCode(HttpStatus.OK)
  calculateLiquidation(
    @Param('affaireId') affaireId: string,
    @Body() input: LiquidationInput,
  ) {
    return this.service.calculateLiquidation(affaireId, input);
  }

  @Post(':affaireId/calculate-distribution')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Calculer la distribution de prime par réassureur' })
  @HttpCode(HttpStatus.OK)
  calculateDistribution(
    @Param('affaireId') affaireId: string,
    @Body('primeNetteCedante') primeNetteCedante: number,
  ) {
    return this.service.calculateDistribution(affaireId, primeNetteCedante);
  }

  // ── PDF ──────────────────────────────────────────────────────────

  @Get(':affaireId/treaty-statement/pdf')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Générer le relevé de compte traité en PDF' })
  async downloadTreatyStatement(
    @Param('affaireId') affaireId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateTreatyStatement(affaireId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="traite-statement-${affaireId}.pdf"`,
    );
    res.send(buffer);
  }

  @Get(':affaireId/pmd-invoice/pdf')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Générer la facture dépôt de prime PMD en PDF' })
  async downloadPmdInvoice(
    @Param('affaireId') affaireId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generatePmdInvoice(affaireId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pmd-invoice-${affaireId}.pdf"`,
    );
    res.send(buffer);
  }
}