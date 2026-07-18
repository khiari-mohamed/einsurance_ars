import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CedantesService } from './cedantes.service';
import { CreateCedanteDto } from './dto/create-cedante.dto';
import { UpdateCedanteDto } from './dto/update-cedante.dto';
import { OverrideCedanteCodeDto } from './dto/override-code.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Cédantes (Compagnies d\'assurances)')
@ApiBearerAuth()
@Controller('master-data/cedantes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CedantesController {
  constructor(private service: CedantesService) {}

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'List all cedantes (compagnies d\'assurances)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  // FIX (new): statut was implemented in the service (visible-in-history requirement,
  // 5.6.7) but had no way to be requested from the API. Default 'ACTIVE' preserves
  // existing behavior for callers who don't pass it (e.g. the affaire-creation picker).
  @ApiQuery({ name: 'statut', required: false, enum: ['ACTIVE', 'INACTIVE', 'ALL'] })
  findAll(
    @Query('search') search?: string,
    // FIX: page/limit were typed `number` but @Query() always returns strings —
    // without explicit coercion, a malformed query (?page=abc) silently produced
    // NaN inside the service's skip/take math, which Prisma throws a raw 500 on.
    // DefaultValuePipe + ParseIntPipe coerce cleanly and reject non-numeric input
    // with a proper 400 instead.
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('statut') statut?: 'ACTIVE' | 'INACTIVE' | 'ALL',
  ) {
    return this.service.findAll(search, page, limit, statut);
  }

  @Get(':id')
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'Get a cedante by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Create a new cedante (compagnie d\'assurances)' })
  create(@Body() dto: CreateCedanteDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Update a cedante' })
  update(@Param('id') id: string, @Body() dto: UpdateCedanteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @ApiOperation({ summary: 'Soft-delete a cedante (set inactive)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
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
  @ApiResponse({ status: 400, description: 'Invalid code format (must be CAS-XXXX)' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  async overrideCode(
    @Param('id') id: string,
    // FIX: was `@Body() body: { code: string }` — an inline TS type, NOT a class, so
    // class-validator's ValidationPipe silently skipped it entirely. Non-string,
    // missing, or malformed `code` values reached the service unvalidated (and could
    // throw a raw 500 instead of a clean 400 if `code` wasn't a string). Now a real
    // DTO class with @IsString() + format regex.
    @Body() body: OverrideCedanteCodeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.overrideCode(id, body.code, user.id);
  }
}