import { Injectable, Logger } from '@nestjs/common';

/**
 * OCR Service — placeholder for Tesseract or cloud OCR integration.
 * Used for auto-extracting data from uploaded PDFs (slips, polices).
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  async extractText(filePath: string): Promise<string> {
    this.logger.log(`OCR requested for: ${filePath}`);
    // TODO: integrate Tesseract.js or Google Vision API
    // For now return empty — OCR is a non-blocking enhancement
    return '';
  }
}