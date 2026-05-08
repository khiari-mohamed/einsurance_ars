import {
  Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SinistreStatut, CashCallStatut } from '@prisma/client';
import { SinistresService } from './sinistres.service';
import { SinistreAnalyticsService } from './sinistre-analytics.service';
import { CreateSinistreDto } from './dto/create-sinistre.dto';
import { UpdateSinistreDto } from './dto/update-sinistre.dto';
import { CreateCashCallDto } from './dto/cash-call.dto';
import { AdjustSapDto } from './dto/adjust-sap.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Sinistres')
@ApiBearerAuth()
@Controller('sinistres')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SinistresController {
  constructor(
    private service: SinistresService,
    private analytics: SinistreAnalyticsService,
  ) {}

  @Get()
  @RequirePermissions(Permission.SINISTRES_READ)
  @ApiQuery({ name: 'affaireId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: SinistreStatut })
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('affaireId') affaireId?: string,
    @Query('statut') statut?: SinistreStatut,
    @Query('cedanteId') cedanteId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) { return this.service.findAll({ affaireId, statut, cedanteId, page, limit }); }

  @Get('analytics/kpis')
  @RequirePermissions(Permission.SINISTRES_READ)
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'year', required: false })
  getKpis(@Query('cedanteId') cedanteId?: string, @Query('year') year?: number) {
    return this.analytics.getKpis(cedanteId, year);
  }

  @Get('analytics/loss-ratio')
  @RequirePermissions(Permission.SINISTRES_READ)
  getLossRatio(@Query('cedanteId') cedanteId?: string, @Query('year') year?: number) {
    return this.analytics.getLossRatio(cedanteId, year);
  }

  @Get(':id')
  @RequirePermissions(Permission.SINISTRES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Get(':id/events')
  @RequirePermissions(Permission.SINISTRES_READ)
  @ApiOperation({ summary: 'Timeline chronologique du sinistre' })
  getEvents(@Param('id') id: string) { return this.service.getEvents(id); }

  @Post()
  @RequirePermissions(Permission.SINISTRES_CREATE)
  create(@Body() dto: CreateSinistreDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateSinistreDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Patch(':id/adjust-sap')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @ApiOperation({ summary: 'Ajuster le SAP (Sinistres A Payer) au 31/12' })
  adjustSap(@Param('id') id: string, @Body() dto: AdjustSapDto, @CurrentUser() user: any) {
    return this.service.adjustSap(id, dto, user.id);
  }

  @Patch(':id/submit-validation')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @HttpCode(HttpStatus.OK)
  submitValidation(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.service.submitForValidation(id, user.id, note);
  }

  @Patch(':id/approve')
  @RequirePermissions(Permission.SINISTRES_VALIDATE)
  @HttpCode(HttpStatus.OK)
  approve(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.service.approve(id, user.id, note);
  }

  @Patch(':id/reject')
  @RequirePermissions(Permission.SINISTRES_VALIDATE)
  @HttpCode(HttpStatus.OK)
  reject(@Param('id') id: string, @Body('motif') motif: string, @CurrentUser() user: any) {
    return this.service.reject(id, user.id, motif);
  }

  @Patch(':id/declare-reassureurs')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @HttpCode(HttpStatus.OK)
  declareReassureurs(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.service.declareToReassureurs(id, user.id, note);
  }

  @Patch(':id/recovery')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @HttpCode(HttpStatus.OK)
  markRecovery(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.service.markInRecovery(id, user.id, note);
  }

  @Patch(':id/close')
  @RequirePermissions(Permission.SINISTRES_CLOSE)
  @HttpCode(HttpStatus.OK)
  close(@Param('id') id: string, @Body('note') note: string, @CurrentUser() user: any) {
    return this.service.close(id, user.id, note);
  }

  @Post(':id/cash-call')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @ApiOperation({ summary: 'Déclencher un appel au comptant' })
  triggerCashCall(@Param('id') id: string, @Body() dto: CreateCashCallDto, @CurrentUser() user: any) {
    return this.service.triggerCashCall(id, dto, user.id);
  }

  @Patch(':id/cash-call/advance')
  @RequirePermissions(Permission.SINISTRES_UPDATE)
  @HttpCode(HttpStatus.OK)
  advanceCashCall(
    @Param('id') id: string,
    @Body('statut') statut: CashCallStatut,
    @Body('note') note: string,
    @CurrentUser() user: any,
  ) {
    return this.service.advanceCashCall(id, statut, user.id, note);
  }
}