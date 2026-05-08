import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AssuresService } from './assures.service';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@ApiTags('Assurés')
@ApiBearerAuth()
@Controller('master-data/assures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssuresController {
  constructor(private service: AssuresService) {}

  @Get() @RequirePermissions(Permission.DONNEES_READ)
  @ApiQuery({ name: 'search', required: false }) @ApiQuery({ name: 'page', required: false }) @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.service.findAll(search, page, limit);
  }

  @Get(':id') @RequirePermissions(Permission.DONNEES_READ)
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post() @RequirePermissions(Permission.DONNEES_CREATE)
  create(@Body() dto: CreateAssureDto) { return this.service.create(dto); }

  @Put(':id') @RequirePermissions(Permission.DONNEES_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateAssureDto) { return this.service.update(id, dto); }

  @Delete(':id') @RequirePermissions(Permission.DONNEES_DELETE)
  remove(@Param('id') id: string) { return this.service.remove(id); }
}