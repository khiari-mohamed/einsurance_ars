import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export type ReportTemplate =
  | 'bordereau-cedante'
  | 'bordereau-reassureur'
  | 'claim-bordereau'
  | 'payment-order'
  | 'pmd-invoice'
  | 'treaty-statement';

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);
  private readonly templatesDir = path.join(
    process.cwd(),
    'src',
    'templates',
  );
  private readonly compiledCache = new Map<string, HandlebarsTemplateDelegate>();

  constructor() {
    this.registerHelpers();
  }

  // ── Public API ────────────────────────────────────────────────────

  async generate(
    templateName: ReportTemplate,
    data: Record<string, unknown>,
    options?: { landscape?: boolean; format?: 'A4' | 'A3' | 'Letter' },
  ): Promise<Buffer> {
    const html = this.render(templateName, data);
    return this.htmlToPdf(html, options);
  }

  async generateBordereauCedante(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('bordereau-cedante', data);
  }

  async generateBordereauReassureur(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('bordereau-reassureur', data);
  }

  async generateClaimBordereau(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('claim-bordereau', data);
  }

  async generatePaymentOrder(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('payment-order', data);
  }

  async generatePmdInvoice(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('pmd-invoice', data);
  }

  async generateTreatyStatement(data: Record<string, unknown>): Promise<Buffer> {
    return this.generate('treaty-statement', data, { landscape: false });
  }

  // ── Rendering ────────────────────────────────────────────────────

  render(templateName: string, data: Record<string, unknown>): string {
    const templatePath = path.join(
      this.templatesDir,
      `${templateName}.hbs`,
    );

    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Template introuvable: ${templateName} (${templatePath})`,
      );
    }

    let compiled = this.compiledCache.get(templateName);

    if (!compiled) {
      const source = fs.readFileSync(templatePath, 'utf8');
      compiled = Handlebars.compile(source, { noEscape: false });
      this.compiledCache.set(templateName, compiled);
    }

    return compiled(data);
  }

  // ── PDF conversion ───────────────────────────────────────────────

  async htmlToPdf(
    html: string,
    options?: { landscape?: boolean; format?: 'A4' | 'A3' | 'Letter' },
  ): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none',
      ],
    });

    try {
      const page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });

      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Wait for charts to finish rendering if any canvas elements exist
      await page
        .evaluate(
          () =>
            new Promise<void>((resolve) => {
              if ((window as unknown as Record<string, unknown>).__chartsReady) {
                resolve();
              } else {
                window.addEventListener('chartsReady', () => resolve(), {
                  once: true,
                });
                setTimeout(resolve, 3000); // fallback: 3s timeout
              }
            }),
        )
        .catch(() => {
          // Non-blocking — proceed even if event never fires
        });

      const buffer = await page.pdf({
        format: options?.format ?? 'A4',
        landscape: options?.landscape ?? false,
        printBackground: true,
        margin: {
          top: '15mm',
          right: '12mm',
          bottom: '15mm',
          left: '12mm',
        },
        displayHeaderFooter: true,
        headerTemplate: `<div></div>`,
        footerTemplate: `
          <div style="font-size:8px;width:100%;text-align:center;
                      color:#888;padding:5px 15mm;">
            ARS Réassurance — Document confidentiel —
            Page <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>`,
      });

      return Buffer.from(buffer);
    } finally {
      await browser.close();
    }
  }

  // ── Handlebars helpers ────────────────────────────────────────────

  private registerHelpers(): void {
    // Date formatting — Tunisian French locale
    Handlebars.registerHelper(
      'formatDate',
      (value: unknown, formatStr?: string) => {
        if (!value) return '—';
        const d = new Date(value as string | number | Date);
        if (isNaN(d.getTime())) return '—';
        if (typeof formatStr === 'string' && formatStr === 'year') {
          return d.getFullYear().toString();
        }
        return d.toLocaleDateString('fr-TN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      },
    );

    // Number formatting — 3 decimal places, space as thousand separator
    Handlebars.registerHelper(
      'formatNumber',
      (value: unknown, decimals?: number) => {
        const num = Number(value ?? 0);
        const d = typeof decimals === 'number' ? decimals : 3;
        return num.toLocaleString('fr-TN', {
          minimumFractionDigits: d,
          maximumFractionDigits: d,
        });
      },
    );

    // Currency formatting
    Handlebars.registerHelper(
      'formatCurrency',
      (value: unknown, currency?: string) => {
        const num = Number(value ?? 0);
        const cur =
          typeof currency === 'string' && currency.length > 0
            ? currency
            : 'TND';
        const formatted = num.toLocaleString('fr-TN', {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        });
        return `${formatted} ${cur}`;
      },
    );

    // Percent formatting
    Handlebars.registerHelper('formatPercent', (value: unknown) => {
      const num = Number(value ?? 0);
      return `${num.toLocaleString('fr-TN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      })} %`;
    });

    // Comparison helpers
    Handlebars.registerHelper(
      'eq',
      (a: unknown, b: unknown) => a === b,
    );
    Handlebars.registerHelper(
      'ne',
      (a: unknown, b: unknown) => a !== b,
    );
    Handlebars.registerHelper(
      'gt',
      (a: unknown, b: unknown) => Number(a) > Number(b),
    );
    Handlebars.registerHelper(
      'lt',
      (a: unknown, b: unknown) => Number(a) < Number(b),
    );
    Handlebars.registerHelper(
      'gte',
      (a: unknown, b: unknown) => Number(a) >= Number(b),
    );
    Handlebars.registerHelper(
      'lte',
      (a: unknown, b: unknown) => Number(a) <= Number(b),
    );

    // Math helpers
    Handlebars.registerHelper(
      'add',
      (a: unknown, b: unknown) =>
        Math.round((Number(a) + Number(b)) * 1000) / 1000,
    );
    Handlebars.registerHelper(
      'subtract',
      (a: unknown, b: unknown) =>
        Math.round((Number(a) - Number(b)) * 1000) / 1000,
    );
    Handlebars.registerHelper(
      'multiply',
      (a: unknown, b: unknown) =>
        Math.round(Number(a) * Number(b) * 1000) / 1000,
    );
    Handlebars.registerHelper('divide', (a: unknown, b: unknown) => {
      const divisor = Number(b);
      if (divisor === 0) return 0;
      return Math.round((Number(a) / divisor) * 1000) / 1000;
    });
    Handlebars.registerHelper('abs', (a: unknown) => Math.abs(Number(a)));

    // Conditional block helper
    Handlebars.registerHelper(
      'ifCond',
      function (
        this: unknown,
        v1: unknown,
        operator: string,
        v2: unknown,
        options: Handlebars.HelperOptions,
      ) {
        let result = false;
        switch (operator) {
          case '==':
            result = v1 == v2; // eslint-disable-line eqeqeq
            break;
          case '===':
            result = v1 === v2;
            break;
          case '!=':
            result = v1 != v2; // eslint-disable-line eqeqeq
            break;
          case '>':
            result = Number(v1) > Number(v2);
            break;
          case '<':
            result = Number(v1) < Number(v2);
            break;
          case '>=':
            result = Number(v1) >= Number(v2);
            break;
          case '<=':
            result = Number(v1) <= Number(v2);
            break;
          default:
            result = false;
        }
        return result ? options.fn(this) : options.inverse(this);
      },
    );

    // Default value
    Handlebars.registerHelper(
      'default',
      (value: unknown, fallback: unknown) =>
        value !== null && value !== undefined && value !== '' ? value : fallback,
    );

    // JSON stringify for passing data to Chart.js
    Handlebars.registerHelper('json', (value: unknown) =>
      JSON.stringify(value),
    );

    // Fixed decimals
    Handlebars.registerHelper(
      'toFixed',
      (value: unknown, decimals: unknown) =>
        Number(value ?? 0).toFixed(Number(decimals ?? 2)),
    );

    // Length of array
    Handlebars.registerHelper(
      'length',
      (arr: unknown) => (Array.isArray(arr) ? arr.length : 0),
    );

    // Current year helper
    Handlebars.registerHelper(
      'currentYear',
      () => new Date().getFullYear(),
    );

    // Uppercase
    Handlebars.registerHelper('upper', (value: unknown) =>
      String(value ?? '').toUpperCase(),
    );

    this.logger.log('Handlebars helpers registered');
  }
}