import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AssuresService } from './assures.service';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';
import { OverrideAssureCodeDto } from './dto/override-code.dto';
import { BulkImportAssuresDto } from './dto/bulk-import-assures.dto';
import { BulkUpdateAssuresDto } from './dto/bulk-update-assures.dto';
import { BulkDeleteAssuresDto } from './dto/bulk-delete-assures.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Assurés')
@ApiBearerAuth()
@Controller('master-data/assures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssuresController {
  constructor(private service: AssuresService) {}

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'List all assurés (clients finaux)' })
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
  @ApiOperation({ summary: 'Get an assuré by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Create a new assuré' })
  create(@Body() dto: CreateAssureDto) {
    return this.service.create(dto);
  }

  @Post('bulk-import')
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Bulk import clients from parsed Excel/CSV rows (partial success allowed)' })
  @ApiResponse({ status: 201, description: 'Per-row created/failed report' })
  bulkImport(@Body() dto: BulkImportAssuresDto) {
    return this.service.bulkImport(dto.items);
  }

  // NOTE: registered BEFORE @Put(':id') — Nest matches routes in declaration
  // order, so a static segment like 'bulk-update' must come before a dynamic
  // ':id' segment on the same HTTP verb, or PUT /assures/bulk-update would be
  // swallowed by update() with id='bulk-update'.
  @Put('bulk-update')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Bulk update shared fields (pays, formeJuridique, isActive) across multiple clients' })
  bulkUpdate(@Body() dto: BulkUpdateAssuresDto) {
    return this.service.bulkUpdate(dto.ids, dto.data);
  }

  @Put(':id')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Update an assuré' })
  update(@Param('id') id: string, @Body() dto: UpdateAssureDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/override-code')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Override auto-generated code with audit trail' })
  @ApiResponse({ status: 200, description: 'Code updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code format (must be CLI-XXXX)' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  async overrideCode(
    @Param('id') id: string,
    @Body() body: OverrideAssureCodeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.overrideCode(id, body.code, user.id);
  }

  @Post('bulk-delete')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk soft-delete (deactivate) multiple clients; skips ones with active affaires' })
  bulkDelete(@Body() dto: BulkDeleteAssuresDto, @CurrentUser() user: any) {
    return this.service.bulkDelete(dto.ids, user?.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @ApiOperation({ summary: 'Soft-delete an assuré (set inactive)' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user?.id);
  }
}