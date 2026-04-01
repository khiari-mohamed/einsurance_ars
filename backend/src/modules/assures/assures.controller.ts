import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, ValidationPipe, HttpCode, HttpStatus, NotFoundException } from '@nestjs/common';
import { AssuresService } from './assures.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { Permission } from '../../config/permissions.config';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';

@Controller('assures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssuresController {
  constructor(private service: AssuresService) {}

  @Get()
  @RequirePermissions(Permission.CLIENT_READ)
  findAll(@Query('search') search?: string) {
    return this.service.findAll(search);
  }

  @Get(':id')
  @RequirePermissions(Permission.CLIENT_READ)
  async findOne(@Param('id') id: string) {
    const assure = await this.service.findOne(id);
    if (!assure) {
      throw new NotFoundException(`Assuré with ID ${id} not found`);
    }
    return assure;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CLIENT_CREATE)
  create(@Body(ValidationPipe) data: CreateAssureDto) {
    return this.service.create(data);
  }

  @Put(':id')
  @RequirePermissions(Permission.CLIENT_UPDATE)
  async update(@Param('id') id: string, @Body(ValidationPipe) data: UpdateAssureDto) {
    const assure = await this.service.update(id, data);
    if (!assure) {
      throw new NotFoundException(`Assuré with ID ${id} not found`);
    }
    return assure;
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
