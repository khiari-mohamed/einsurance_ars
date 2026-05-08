import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BordereauStatut, BordereauType } from '@prisma/client';
import { BordereauxService } from './bordereaux.service';
import { CreateBordereauDto } from './dto/create-bordereau.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Bordereaux')
@ApiBearerAuth()
@Controller('bordereaux')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BordereauxController {
  constructor(private service: BordereauxService) {}

  @Get()
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: BordereauType })
  @ApiQuery({ name: 'statut', required: false, enum: BordereauStatut })
  findAll(
    @Query('affaireId') affaireId?: string,
    @Query('type') type?: BordereauType,
    @Query('statut') statut?: BordereauStatut,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) { return this.service.findAll({ affaireId, type, statut, page, limit }); }

  @Get(':id')
  @RequirePermissions(Permission.AFFAIRES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Créer un bordereau manuellement' })
  create(@Body() dto: CreateBordereauDto) { return this.service.create(dto); }

  @Post('generate')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Générer automatiquement un bordereau depuis les données de l\'affaire' })
  generate(@Body() dto: GenerateBordereauDto) { return this.service.generate(dto); }

  @Patch(':id/emit')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  @ApiOperation({ summary: 'Émettre un bordereau (BROUILLON → EMIS)' })
  emit(@Param('id') id: string) { return this.service.emit(id); }

  @Patch(':id/acquitte')
  @RequirePermissions(Permission.FINANCES_APPROVE)
  @ApiOperation({ summary: 'Marquer un bordereau comme acquitté (EMIS → ACQUITTE)' })
  acquitte(@Param('id') id: string) { return this.service.markAcquitte(id); }

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