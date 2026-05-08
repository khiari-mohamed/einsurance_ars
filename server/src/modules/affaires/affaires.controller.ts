import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AffaireStatut, AffaireType } from '@prisma/client';
import { AffairesService } from './affaires.service';
import { CreateAffaireDto } from './dto/create-affaire.dto';
import { UpdateAffaireDto } from './dto/update-affaire.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../config/permissions.config';

@ApiTags('Affaires')
@ApiBearerAuth()
@Controller('affaires')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AffairesController {
  constructor(private service: AffairesService) {}

  @Get()
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiQuery({ name: 'cedanteId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: AffaireStatut })
  @ApiQuery({ name: 'type', required: false, enum: AffaireType })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('cedanteId') cedanteId?: string,
    @Query('statut') statut?: AffaireStatut,
    @Query('type') type?: AffaireType,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({ cedanteId, statut, type, search, page, limit });
  }

  @Get(':id')
  @RequirePermissions(Permission.AFFAIRES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_CREATE)
  create(@Body() dto: CreateAffaireDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateAffaireDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.AFFAIRES_VALIDATE)
  @ApiOperation({ summary: 'Changer le statut d\'une affaire (workflow)' })
  changeStatus(
    @Param('id') id: string,
    @Body('statut') statut: AffaireStatut,
    @CurrentUser() user: any,
  ) {
    return this.service.changeStatus(id, statut, user.id);
  }

  @Post(':id/recalculate-commissions')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Recalculer les commissions d\'une affaire facultative' })
  recalculate(@Param('id') id: string) {
    return this.service.recalculateCommissions(id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.AFFAIRES_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }
}