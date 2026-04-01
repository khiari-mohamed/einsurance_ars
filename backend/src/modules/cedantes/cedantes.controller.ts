import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, ValidationPipe, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { CedantesService } from './cedantes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../../config/permissions.config';
import { CreateCedanteDto } from './dto/create-cedante.dto';
import { UpdateCedanteDto } from './dto/update-cedante.dto';

@Controller('cedantes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CedantesController {
  constructor(private service: CedantesService) {}

  @Get()
  @RequirePermissions(Permission.CLIENT_READ)
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get(':id')
  @RequirePermissions(Permission.CLIENT_READ)
  async findOne(@Param('id') id: string) {
    const cedante = await this.service.findOne(id);
    if (!cedante) {
      throw new NotFoundException(`Cédante with ID ${id} not found`);
    }
    return cedante;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CLIENT_CREATE)
  create(@Body(ValidationPipe) data: CreateCedanteDto) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermissions(Permission.CLIENT_UPDATE)
  async update(@Param('id') id: string, @Body(ValidationPipe) data: UpdateCedanteDto) {
    const cedante = await this.service.update(id, data);
    if (!cedante) {
      throw new NotFoundException(`Cédante with ID ${id} not found`);
    }
    return cedante;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.CLIENT_DELETE)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }

  @Get(':id/contacts')
  getContacts(@Param('id') id: string) {
    return this.service.getContacts(id);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  addContact(@Param('id') id: string, @Body(ValidationPipe) data: any) {
    return this.service.addContact(id, data);
  }

  @Put(':id/contacts/:contactId')
  updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body(ValidationPipe) data: any
  ) {
    return this.service.updateContact(contactId, data);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(@Param('contactId') contactId: string) {
    return this.service.removeContact(contactId);
  }
}
