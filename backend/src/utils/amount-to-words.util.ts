const units = ['', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF'];
const teens = ['DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE', 'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF'];
const tens = ['', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE', 'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT'];

function convertLessThanThousand(num: number): string {
  if (num === 0) return '';
  
  let result = '';
  const hundreds = Math.floor(num / 100);
  const remainder = num % 100;
  
  if (hundreds > 0) {
    result = hundreds === 1 ? 'CENT' : `${units[hundreds]} CENT`;
    if (remainder === 0 && hundreds > 1) result += 'S';
  }
  
  if (remainder > 0) {
    if (result) result += ' ';
    
    if (remainder < 10) {
      result += units[remainder];
    } else if (remainder < 20) {
      result += teens[remainder - 10];
    } else {
      const tensDigit = Math.floor(remainder / 10);
      const onesDigit = remainder % 10;
      
      if (tensDigit === 7 || tensDigit === 9) {
        result += tens[tensDigit] + (onesDigit === 1 ? ' ET ONZE' : `-${teens[onesDigit]}`);
      } else {
        result += tens[tensDigit];
        if (onesDigit === 1 && tensDigit !== 8) {
          result += ' ET UN';
        } else if (onesDigit > 0) {
          result += `-${units[onesDigit]}`;
        }
        if (tensDigit === 8 && onesDigit === 0) result += 'S';
      }
    }
  }
  
  return result;
}

export function amountToWords(amount: number): string {
  if (amount === 0) return 'ZÉRO DINAR';
  
  const dinars = Math.floor(amount);
  const millimes = Math.round((amount - dinars) * 1000);
  
  let result = '';
  
  if (dinars === 0) {
    result = 'ZÉRO DINAR';
  } else {
    const millions = Math.floor(dinars / 1000000);
    const thousands = Math.floor((dinars % 1000000) / 1000);
    const remainder = dinars % 1000;
    
    if (millions > 0) {
      result = millions === 1 ? 'UN MILLION' : `${convertLessThanThousand(millions)} MILLIONS`;
    }
    
    if (thousands > 0) {
      if (result) result += ' ';
      result += thousands === 1 ? 'MILLE' : `${convertLessThanThousand(thousands)} MILLE`;
    }
    
    if (remainder > 0) {
      if (result) result += ' ';
      result += convertLessThanThousand(remainder);
    }
    
    result += dinars === 1 ? ' DINAR' : ' DINARS';
  }
  
  if (millimes > 0) {
    result += `, ${millimes.toString().padStart(3, '0')} MILLIMES`;
  }
  
  return result;
}

export function formatAmountWithWords(amount: number): string {
  const formatted = amount.toFixed(3);
  const words = amountToWords(amount);
  return `${formatted} TND (${words})`;
}
