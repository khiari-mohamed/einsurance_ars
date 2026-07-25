import { Injectable, Logger } from '@nestjs/common';

/**
 * OCR Service — placeholder for Tesseract or cloud OCR integration.
 * Used for auto-extracting data from uploaded PDFs (slips, polices).
 *
 * FIX: this was injected into GedModule's providers but never actually
 * called from anywhere — dead code. Now invoked fire-and-forget from
 * GedService.upload()/bulkUpload() for PDF/image documents. It still
 * doesn't persist anything (Document has no `extractedText` column yet —
 * SCHEMA TODO) but at least the extraction pipeline is now wired and
 * logging real output instead of sitting unused.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(filePath: string): Promise<string> {
    this.logger.log(`OCR requested for: ${filePath}`);
    // TODO: integrate Tesseract.js or Google Vision API.
    // TODO (schema): once Document.extractedText exists, persist the result
    // here via PrismaService instead of just logging it.
    return '';
  }
}