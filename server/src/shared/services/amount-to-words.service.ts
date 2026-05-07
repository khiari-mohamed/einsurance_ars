import { Injectable } from '@nestjs/common';
import { amountToWordsTND } from '../../utils/amount-to-words.util';

@Injectable()
export class AmountToWordsService {
  toWords(amount: number | string, currency = 'TND'): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num)) return 'ZÉRO DINAR';
    if (currency === 'TND') return amountToWordsTND(num);
    // For foreign currencies return numeric string — TND is the legal requirement
    return `${num.toFixed(3)} ${currency}`;
  }
}