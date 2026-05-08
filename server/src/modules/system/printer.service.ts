import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PrinterService {
  constructor(private prisma: PrismaService) {}

  getAll() {
    return this.prisma.printerConfig.findMany({ orderBy: { reportType: 'asc' } });
  }

  getForReport(reportType: string) {
    return this.prisma.printerConfig.findFirst({
      where: { reportType, isDefault: true },
    });
  }

  async upsert(reportType: string, data: { printerName?: string; paperFormat?: string; isDefault?: boolean }) {
    const existing = await this.prisma.printerConfig.findFirst({ where: { reportType } });
    if (existing) {
      return this.prisma.printerConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.printerConfig.create({ data: { reportType, ...data } });
  }

  async remove(id: string) {
    const p = await this.prisma.printerConfig.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Config imprimante introuvable');
    return this.prisma.printerConfig.delete({ where: { id } });
  }
}