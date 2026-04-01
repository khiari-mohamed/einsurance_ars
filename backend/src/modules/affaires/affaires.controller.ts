import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, Request, ValidationPipe } from '@nestjs/common';
import { AffairesService } from './affaires.service';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateAffaireDto } from './dto/create-affaire.dto';
import { UpdateAffaireDto } from './dto/update-affaire.dto';
import { AffaireStatus } from './affaires.entity';

@Controller('affaires')
@UseGuards(JwtAuthGuard)
export class AffairesController {
  constructor(
    private service: AffairesService,
    private workflowService: WorkflowService,
  ) {}

  @Get()
  findAll(
    @Query('assureId') assureId?: string,
    @Query('cedanteId') cedanteId?: string,
    @Query('status') status?: AffaireStatus,
    @Query('category') category?: string,
    @Query('exercice') exercice?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll({
      assureId,
      cedanteId,
      status,
      category,
      exercice: exercice ? parseInt(exercice) : undefined,
      search,
    });
  }

  @Get('statistics/summary')
  getStatistics(
    @Query('exercice') exercice?: string,
    @Query('cedanteId') cedanteId?: string,
  ) {
    return this.service.getStatistics({
      exercice: exercice ? parseInt(exercice) : undefined,
      cedanteId,
    });
  }

  @Get('facultatives')
  getFacultatives() {
    return this.service.findAll({ category: 'facultative' });
  }

  @Get('traites')
  getTraites() {
    return this.service.findAll({ category: 'traitee' });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body(ValidationPipe) data: CreateAffaireDto, @Request() req) {
    return this.service.create(data, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body(ValidationPipe) data: UpdateAffaireDto) {
    return this.service.update(id, data);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: AffaireStatus, @Request() req) {
    return this.service.updateStatus(id, status, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/send-cotation')
  sendToCotation(@Param('id') id: string) {
    return this.workflowService.sendToCotation(id);
  }

  @Post(':id/receive-slip')
  receiveSlip(
    @Param('id') id: string,
    @Body('slipReference') slipReference: string,
    @Body('signedReinsurers') signedReinsurers: string[],
  ) {
    return this.workflowService.receiveSlip(id, slipReference, signedReinsurers);
  }

  @Get(':id/bordereau/cedante')
  generateBordereauCedante(@Param('id') id: string) {
    return this.workflowService.generateBordereauCedante(id);
  }

  @Get(':id/bordereau/reassureur/:reassureurId')
  generateBordereauReassureur(
    @Param('id') id: string,
    @Param('reassureurId') reassureurId: string,
  ) {
    return this.workflowService.generateBordereauReassureur(id, reassureurId);
  }

  @Get(':id/accounting-entries')
  generateAccountingEntries(@Param('id') id: string) {
    return this.workflowService.generateAccountingEntries(id);
  }
}
