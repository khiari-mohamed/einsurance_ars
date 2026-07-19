import { Controller, Get, Query, UseGuards, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Référentiel — Historique')
@ApiBearerAuth()
@Controller('master-data/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private service: AuditService) {}

  @Get('referentiel-history')
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'Get deactivation history for all référentiel entities' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'entityType', required: false, enum: ['ASSURE', 'CEDANTE', 'REASSUREUR', 'CO_COURTIER'] })
  @ApiQuery({ name: 'search', required: false })
  getReferentielHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getReferentielHistory(page, limit, entityType, search);
  }
}
