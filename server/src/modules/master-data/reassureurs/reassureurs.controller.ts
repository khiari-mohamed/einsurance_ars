import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReassureursService } from './reassureurs.service';
import { CreateReassureurDto } from './dto/create-reassureur.dto';
import { UpdateReassureurDto } from './dto/update-reassureur.dto';
import { BulkImportReassureursDto } from './dto/bulk-import-reassureurs.dto';
import { BulkUpdateReassureursDto } from './dto/bulk-update-reassureurs.dto';
import { BulkDeleteReassureursDto } from './dto/bulk-delete-reassureurs.dto';
import { OverrideReassureurCodeDto } from './dto/override-code.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Réassureurs')
@ApiBearerAuth()
@Controller('master-data/reassureurs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReassureursController {
  constructor(private service: ReassureursService) {}

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'List all reassureurs' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: ['ACTIVE', 'INACTIVE', 'ALL'] })
  findAll(
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('statut') statut?: 'ACTIVE' | 'INACTIVE' | 'ALL',
  ) {
    return this.service.findAll(search, page, limit, statut);
  }

  @Get(':id')
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'Get a reassureur by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Create a new reassureur' })
  create(@Body() dto: CreateReassureurDto) {
    return this.service.create(dto);
  }

  @Post('bulk-import')
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Bulk import réassureurs from parsed Excel/CSV rows (partial success allowed)' })
  @ApiResponse({ status: 201, description: 'Per-row created/failed report' })
  bulkImport(@Body() dto: BulkImportReassureursDto) {
    return this.service.bulkImport(dto.items);
  }

  // NOTE: registered BEFORE @Put(':id') / @Post(':id/...') — same routing-order
  // reason as Cedantes/Assurés: a static segment must precede a dynamic ':id'
  // segment on the same verb, or e.g. PUT /reassureurs/bulk-update would be
  // swallowed by update() with id='bulk-update'.
  @Put('bulk-update')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Bulk update shared fields (pays, formeJuridique, isActive) across multiple réassureurs' })
  bulkUpdate(@Body() dto: BulkUpdateReassureursDto) {
    return this.service.bulkUpdate(dto.ids, dto.data);
  }

  @Post('bulk-delete')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk soft-delete (deactivate) multiple réassureurs; skips ones with active participations' })
  bulkDelete(@Body() dto: BulkDeleteReassureursDto, @CurrentUser() user: any) {
    return this.service.bulkDelete(dto.ids, user?.id);
  }

  @Put(':id')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Update a reassureur' })
  update(@Param('id') id: string, @Body() dto: UpdateReassureurDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @ApiOperation({ summary: 'Soft-delete a reassureur (set inactive)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user?.id);
  }

  /**
   * ADMIN ONLY: Override the auto-generated code.
   * Requires SUPER_ADMIN role.
   */
  @Post(':id/override-code')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Override auto-generated code with audit trail' })
  @ApiResponse({ status: 200, description: 'Code updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code format (must be REA-XXXX)' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  async overrideCode(
    @Param('id') id: string,
    @Body() body: OverrideReassureurCodeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.overrideCode(id, body.code, user.id);
  }
}