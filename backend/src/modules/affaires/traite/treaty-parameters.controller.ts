import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TreatyParametersService, CreateTreatyParametersDto, UpdateTreatyParametersDto } from './treaty-parameters.service';

@Controller('treaty-parameters')
@UseGuards(JwtAuthGuard)
export class TreatyParametersController {
  constructor(private readonly parametersService: TreatyParametersService) {}

  @Post()
  async create(@Body() createDto: CreateTreatyParametersDto, @Request() req) {
    return this.parametersService.create(createDto, req.user.userId);
  }

  @Get('affaire/:affaireId')
  async findByAffaire(
    @Param('affaireId') affaireId: string,
    @Query('activeOnly') activeOnly?: string
  ) {
    return this.parametersService.findByAffaire(affaireId, activeOnly !== 'false');
  }

  @Get('affaire/:affaireId/active')
  async findActive(@Param('affaireId') affaireId: string) {
    return this.parametersService.findActive(affaireId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.parametersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTreatyParametersDto & { motif?: string },
    @Request() req
  ) {
    const { motif, ...updateDto } = body;
    return this.parametersService.update(id, updateDto, req.user.userId, motif);
  }

  @Post('affaire/:affaireId/renew')
  async renewForNextYear(
    @Param('affaireId') affaireId: string,
    @Body() modifications: Partial<CreateTreatyParametersDto>,
    @Request() req
  ) {
    return this.parametersService.renewForNextYear(affaireId, req.user.userId, modifications);
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.parametersService.deactivate(id);
  }

  @Get('affaire/:affaireId/history')
  async getModificationHistory(@Param('affaireId') affaireId: string) {
    return this.parametersService.getModificationHistory(affaireId);
  }
}
