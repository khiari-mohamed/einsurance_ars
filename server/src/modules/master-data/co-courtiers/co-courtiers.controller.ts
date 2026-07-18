import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CoCourtierService } from './co-courtiers.service';
import { CreateCoCourtierDto } from './dto/create-co-courtier.dto';
import { UpdateCoCourtierDto } from './dto/update-co-courtier.dto';
import { OverrideCoCourtierCodeDto } from './dto/override-code.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Co-courtiers')
@ApiBearerAuth()
@Controller('master-data/co-courtiers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CoCourtierController {
  constructor(private service: CoCourtierService) {}

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  @ApiOperation({ summary: 'List all co-courtiers (courtiers en réassurance)' })
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
  @ApiOperation({ summary: 'Get a co-courtier by ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  @ApiOperation({ summary: 'Create a new co-courtier' })
  create(@Body() dto: CreateCoCourtierDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermissions(Permission.DONNEES_UPDATE)
  @ApiOperation({ summary: 'Update a co-courtier' })
  update(@Param('id') id: string, @Body() dto: UpdateCoCourtierDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/override-code')
  @RequirePermissions(Permission.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Override auto-generated code with audit trail' })
  @ApiResponse({ status: 200, description: 'Code updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid code format (must be CCO-XXXX)' })
  @ApiResponse({ status: 409, description: 'Code already in use' })
  async overrideCode(
    @Param('id') id: string,
    @Body() body: OverrideCoCourtierCodeDto,
    @CurrentUser() user: any,
  ) {
    return this.service.overrideCode(id, body.code, user.id);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  @ApiOperation({ summary: 'Soft-delete a co-courtier (set inactive)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}