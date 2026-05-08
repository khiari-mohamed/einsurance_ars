import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReassureursService } from './reassureurs.service';
import { CreateReassureurDto } from './dto/create-reassureur.dto';
import { UpdateReassureurDto } from './dto/update-reassureur.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Réassureurs')
@ApiBearerAuth()
@Controller('master-data/reassureurs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReassureursController {
  constructor(private service: ReassureursService) {}

  @Get() @RequirePermissions(Permission.DONNEES_READ)
  @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('search') s?: string, @Query('page') p?: number, @Query('limit') l?: number) { return this.service.findAll(s, p, l); }

  @Get(':id') @RequirePermissions(Permission.DONNEES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post() @RequirePermissions(Permission.DONNEES_CREATE)
  create(@Body() dto: CreateReassureurDto) { return this.service.create(dto); }

  @Put(':id') @RequirePermissions(Permission.DONNEES_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateReassureurDto) { return this.service.update(id, dto); }

  @Delete(':id') @RequirePermissions(Permission.DONNEES_DELETE)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}