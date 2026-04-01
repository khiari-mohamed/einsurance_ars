import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GuaranteeLineService, CreateGuaranteeLineDto, UpdateGuaranteeLineDto } from './guarantee-line.service';

@Controller('guarantee-lines')
@UseGuards(JwtAuthGuard)
export class GuaranteeLineController {
  constructor(private readonly guaranteeLineService: GuaranteeLineService) {}

  @Post()
  async create(@Body() createDto: CreateGuaranteeLineDto) {
    return this.guaranteeLineService.create(createDto);
  }

  @Get('affaire/:affaireId')
  async findByAffaire(@Param('affaireId') affaireId: string) {
    return this.guaranteeLineService.findByAffaire(affaireId);
  }

  @Get('affaire/:affaireId/totals')
  async getTotals(@Param('affaireId') affaireId: string) {
    return this.guaranteeLineService.getTotals(affaireId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.guaranteeLineService.findOne(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateGuaranteeLineDto) {
    return this.guaranteeLineService.update(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.guaranteeLineService.delete(id);
    return { message: 'Guarantee line deleted successfully' };
  }

  @Post('affaire/:affaireId/reorder')
  async reorder(@Param('affaireId') affaireId: string, @Body() body: { lineIds: string[] }) {
    return this.guaranteeLineService.reorder(affaireId, body.lineIds);
  }
}
