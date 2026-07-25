import { Controller, Get, Post, Put, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TreatyParametersService } from './treaty-parameters.service';
import { CreateTreatyParameterVersionDto } from './dto/create-parameter-version.dto';
import { UpdateTreatyParameterVersionDto } from './dto/update-parameter-version.dto';
import { RenewTreatyParameterVersionDto } from './dto/renew-parameter-version.dto';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Permission } from '../../../../config/permissions.config';

@ApiTags('Traités — Paramètres commerciaux')
@ApiBearerAuth()
@Controller('traites/:affaireId/parameters')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TreatyParametersController {
  constructor(private readonly service: TreatyParametersService) {}

  @Get('active')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Version active des paramètres commerciaux du traité' })
  getActive(@Param('affaireId') affaireId: string) {
    return this.service.getActive(affaireId);
  }

  @Get('history')
  @RequirePermissions(Permission.AFFAIRES_READ)
  @ApiOperation({ summary: 'Historique des versions de paramètres commerciaux' })
  getHistory(@Param('affaireId') affaireId: string) {
    return this.service.getHistory(affaireId);
  }

  @Post()
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Créer la version initiale des paramètres commerciaux (v1)' })
  createInitial(
    @Param('affaireId') affaireId: string,
    @Body() dto: CreateTreatyParameterVersionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createInitial(affaireId, dto, user.id);
  }

  @Put('active')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @ApiOperation({ summary: 'Remplacer la version active par une nouvelle version (motif requis)' })
  supersede(
    @Param('affaireId') affaireId: string,
    @Body() dto: UpdateTreatyParameterVersionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.supersede(affaireId, dto, user.id);
  }

  @Post('renew')
  @RequirePermissions(Permission.AFFAIRES_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Créer une nouvelle version pour la période suivante (renouvellement)' })
  renew(
    @Param('affaireId') affaireId: string,
    @Body() dto: RenewTreatyParameterVersionDto,
    @CurrentUser() user: any,
  ) {
    return this.service.renew(affaireId, dto, user.id);
  }
}