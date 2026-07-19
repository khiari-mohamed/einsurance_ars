import {
  Body, Controller, Delete, Get, Param, Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';
import { ConventionsService } from './conventions.service';
import { AttachConventionDto, ConventionPartnerType } from './dto/attach-convention.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Permission } from '../../../config/permissions.config';

@Controller('master-data/conventions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ConventionsController {
  constructor(private readonly conventions: ConventionsService) {}

  @Post()
  @RequirePermissions(Permission.DONNEES_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  async attach(
    @UploadedFile() file: MulterFile,
    @Body() dto: AttachConventionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.conventions.attach(file, dto, user?.id);
  }

  @Get()
  @RequirePermissions(Permission.DONNEES_READ)
  async list(
    @Query('partnerType') partnerType: ConventionPartnerType,
    @Query('partnerId') partnerId: string,
  ) {
    return this.conventions.listForPartner(partnerType, partnerId);
  }

  @Delete(':id')
  @RequirePermissions(Permission.DONNEES_DELETE)
  async deactivate(@Param('id') id: string) {
    return this.conventions.deactivate(id);
  }
}