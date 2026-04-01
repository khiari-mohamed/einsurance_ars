import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SlipsService } from './slips.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('slips')
@UseGuards(JwtAuthGuard)
export class SlipsController {
  constructor(private service: SlipsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('affaire/:id')
  findByAffaire(@Param('id') id: string) {
    return this.service.findAll({ affaireId: id });
  }

  @Post()
  create(@Body() data: any) {
    return this.service.createCotationRequest(data.affaireId, data.reassureurIds, data.userId);
  }
}
