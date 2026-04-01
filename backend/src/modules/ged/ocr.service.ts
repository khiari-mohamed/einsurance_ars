import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './document.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Sinistre } from '../sinistres/sinistres.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';

interface OcrResult {
  text: string;
  confidence: number;
  entities: any[];
  referenceNumbers: string[];
  documentType?: string;
  structuredData?: any;
}

@Injectable()
export class OcrService {
  constructor(
    @InjectRepository(Document) private documentRepo: Repository<Document>,
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    @InjectRepository(Bordereau) private bordereauRepo: Repository<Bordereau>,
  ) {}

  async processDocument(documentId: string, buffer: Buffer, mimeType: string): Promise<OcrResult> {
    const extractedText = await this.extractText(buffer, mimeType);
    const extractedData = this.extractStructuredData(extractedText);
    const docType = this.classifyDocument(extractedText);
    const entities = await this.matchEntities(extractedData, docType);
    
    const confidence = this.calculateConfidence(extractedText, extractedData);

    await this.documentRepo.update(documentId, {
      ocrText: extractedText,
      referenceNumber: extractedData.referenceNumbers[0] || null,
    });

    return {
      text: extractedText,
      confidence,
      entities,
      referenceNumbers: extractedData.referenceNumbers,
      documentType: docType,
      structuredData: extractedData,
    };
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      return this.extractFromPdf(buffer);
    } else if (mimeType.startsWith('image/')) {
      return this.extractFromImage(buffer);
    }
    return '';
  }

  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('PDF extraction failed:', error);
      return '';
    }
  }

  private async extractFromImage(buffer: Buffer): Promise<string> {
    try {
      const Tesseract = require('tesseract.js');
      const { data: { text } } = await Tesseract.recognize(buffer, 'fra+eng+ara', {
        logger: () => {},
        tessedit_pageseg_mode: 3,
      });
      return text;
    } catch (error) {
      console.error('Image OCR failed:', error);
      return '';
    }
  }

  private extractStructuredData(text: string): any {
    const dates: Date[] = [];
    const amounts: number[] = [];
    const referenceNumbers: string[] = [];
    const companies: string[] = [];
    const currencies: string[] = [];

    const dateRegex = /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g;
    const dateMatches = text.match(dateRegex);
    if (dateMatches) {
      dateMatches.forEach(d => {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) dates.push(parsed);
      });
    }

    const amountRegex = /\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?\b/g;
    const amountMatches = text.match(amountRegex);
    if (amountMatches) {
      amountMatches.forEach(a => {
        const num = parseFloat(a.replace(/[,\s]/g, ''));
        if (!isNaN(num) && num > 100) amounts.push(num);
      });
    }

    const refRegex = /\b(?:AFF|BORD|SIN|SLIP|REF|N°|NO)[:\s-]*([A-Z0-9\-]+)\b/gi;
    const refMatches = text.match(refRegex);
    if (refMatches) refMatches.forEach(r => referenceNumbers.push(r.trim()));

    const currencyRegex = /\b(TND|EUR|USD|GBP|CHF)\b/g;
    const currencyMatches = text.match(currencyRegex);
    if (currencyMatches) currencies.push(...currencyMatches);

    const companyRegex = /\b(STAR|COMAR|GAT|LLOYD|SWISS\s*RE|MUNICH\s*RE|SCOR)\b/gi;
    const companyMatches = text.match(companyRegex);
    if (companyMatches) companies.push(...companyMatches);

    return { dates, amounts, referenceNumbers, companies, currencies };
  }

  private classifyDocument(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes('slip') && lower.includes('cotation')) return 'SLIP_COTATION';
    if (lower.includes('slip') && lower.includes('couverture')) return 'SLIP_COUVERTURE';
    if (lower.includes('bordereau') && lower.includes('cession')) return 'BORDEREAU_CESSION';
    if (lower.includes('bordereau') && lower.includes('sinistre')) return 'BORDEREAU_SINISTRE';
    if (lower.includes('avis') && lower.includes('sinistre')) return 'AVIS_SINISTRE';
    if (lower.includes('facture') || lower.includes('invoice')) return 'FACTURE';
    return 'UNKNOWN';
  }

  private async matchEntities(data: any, docType: string): Promise<any[]> {
    const entities = [];

    for (const ref of data.referenceNumbers) {
      if (ref.includes('AFF')) {
        const affaire = await this.affaireRepo.findOne({ where: { numeroAffaire: ref } });
        if (affaire) entities.push({ type: 'affaire', id: affaire.id, reference: ref });
      }
      if (ref.includes('SIN')) {
        const sinistre = await this.sinistreRepo.findOne({ where: { numero: ref } });
        if (sinistre) entities.push({ type: 'sinistre', id: sinistre.id, reference: ref });
      }
      if (ref.includes('BORD')) {
        const bordereau = await this.bordereauRepo.findOne({ where: { numero: ref } });
        if (bordereau) entities.push({ type: 'bordereau', id: bordereau.id, reference: ref });
      }
    }

    return entities;
  }

  private calculateConfidence(text: string, data: any): number {
    let score = 0;
    if (text.length > 100) score += 0.3;
    if (data.referenceNumbers.length > 0) score += 0.3;
    if (data.amounts.length > 0) score += 0.2;
    if (data.dates.length > 0) score += 0.2;
    return Math.min(score, 1.0);
  }
}
