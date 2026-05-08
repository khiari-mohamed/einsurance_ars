import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
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
import { AffaireStatut, ModeRenouvellement } from '@prisma/client';
import { FacultativeService } from './facultative.service';
import {
  CreateFacultativeDto,
  GuaranteeLineDto,
} from './dto/create-facultative.dto';
import { UpdateFacultativeDto } from './dto/update-facultative.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Facultatives')
@ApiBearerAuth()
@Controller('facultatives')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FacultativeController {
  constructor(private readonly service: FacultativeService) {}

  @Get()
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Liste toutes les affaires facultatives avec filtres' })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'assureId', required: false })
  @ApiQuery({ name: 'branche', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: AffaireStatut })
  @ApiQuery({ name: 'dateEffetFrom', required: false })
  @ApiQuery({ name: 'dateEffetTo', required: false })
  @ApiQuery({ name: 'modeRenouvellement', required: false, enum: ModeRenouvellement })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('cedanteId') cedanteId?: string,
    @Query('assureId') assureId?: string,
    @Query('branche') branche?: string,
    @Query('statut') statut?: AffaireStatut,
    @Query('dateEffetFrom') dateEffetFrom?: string,
    @Query('dateEffetTo') dateEffetTo?: string,
    @Query('modeRenouvellement') modeRenouvellement?: ModeRenouvellement,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({
      cedanteId,
      assureId,
      branche,
      statut,
      dateEffetFrom,
      dateEffetTo,
      modeRenouvellement,
      search,
      page,
      limit,
    });
  }

  @Get('renewals-alert')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Affaires facultatives arrivant à échéance prochainement' })
  @ApiQuery({ name: 'daysAhead', required: false, description: 'Nombre de jours (défaut 30)' })
  getRenewalsAlert(@Query('daysAhead') daysAhead?: number) {
    return this.service.getRenewalsAlert(daysAhead ? Number(daysAhead) : 30);
  }

  @Get('stats/by-branch')
  @RequirePermissions(Permission.REPORTING_READ)
  @ApiOperation({ summary: 'Statistiques primes cédées par branche' })
  @ApiQuery({ name: 'year', required: false })
  getStatsByBranch(@Query('year') year?: number) {
    return this.service.getStatsByBranch(year ? Number(year) : undefined);
  }

  @Get(':affaireId')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: "Détail complet d'une affaire facultative" })
  findOne(@Param('affaireId') affaireId: string) {
    return this.service.findOne(affaireId);
  }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_CREATE)
  @ApiOperation({ summary: "Créer les données facultatives d'une affaire existante" })
  create(@Body() dto: CreateFacultativeDto) {
    return this.service.create(dto);
  }

  @Put(':affaireId')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Mettre à jour les données facultatives' })
  update(
    @Param('affaireId') affaireId: string,
    @Body() dto: UpdateFacultativeDto,
  ) {
    return this.service.update(affaireId, dto);
  }

  @Post(':affaireId/recalculate-commissions')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Recalculer les commissions de tous les réassureurs' })
  @HttpCode(HttpStatus.OK)
  recalculateCommissions(@Param('affaireId') affaireId: string) {
    return this.service.recalculateCommissions(affaireId);
  }

  // ── Guarantee lines ──────────────────────────────────────────────

  @Put(':affaireId/guarantee-lines')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Remplacer toutes les lignes de garantie' })
  replaceGuaranteeLines(
    @Param('affaireId') affaireId: string,
    @Body() lines: GuaranteeLineDto[],
  ) {
    return this.service.replaceGuaranteeLines(affaireId, lines);
  }

  @Post(':affaireId/guarantee-lines')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Ajouter une ligne de garantie' })
  addGuaranteeLine(
    @Param('affaireId') affaireId: string,
    @Body() line: GuaranteeLineDto,
  ) {
    return this.service.addGuaranteeLine(affaireId, line);
  }

  @Delete(':affaireId/guarantee-lines/:lineId')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Supprimer une ligne de garantie' })
  @HttpCode(HttpStatus.OK)
  removeGuaranteeLine(
    @Param('affaireId') affaireId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.service.removeGuaranteeLine(affaireId, lineId);
  }

  // ── PDF ──────────────────────────────────────────────────────────

  @Get(':affaireId/slip/pdf')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Générer le slip de cotation en PDF' })
  async downloadSlip(
    @Param('affaireId') affaireId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.service.generateSlip(affaireId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="slip-facultative-${affaireId}.pdf"`,
    );
    res.send(buffer);
  }
}