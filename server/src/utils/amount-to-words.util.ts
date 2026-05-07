// Converts a decimal amount to French words — legal requirement on bordereaux
// e.g. 148.994 → "CENT QUARANTE HUIT DINARS, 994 MILLIMES"

const ONES = [
  '', 'UN', 'DEUX', 'TROIS', 'QUATRE', 'CINQ', 'SIX', 'SEPT', 'HUIT', 'NEUF',
  'DIX', 'ONZE', 'DOUZE', 'TREIZE', 'QUATORZE', 'QUINZE', 'SEIZE',
  'DIX-SEPT', 'DIX-HUIT', 'DIX-NEUF',
];

const TENS = [
  '', '', 'VINGT', 'TRENTE', 'QUARANTE', 'CINQUANTE',
  'SOIXANTE', 'SOIXANTE', 'QUATRE-VINGT', 'QUATRE-VINGT',
];

function convertHundreds(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const one = n % 10;
    if (ten === 7) return `SOIXANTE-${ONES[10 + one]}`;
    if (ten === 9) return `QUATRE-VINGT-${ONES[10 + one] || 'DIX'}`.replace(/-$/, '');
    const tensWord = TENS[ten];
    if (one === 0) return ten === 8 ? 'QUATRE-VINGTS' : tensWord;
    const joiner = one === 1 && ten !== 8 ? '-ET-' : '-';
    return `${tensWord}${joiner}${ONES[one]}`;
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const hundredsWord = hundreds === 1 ? 'CENT' : `${ONES[hundreds]} CENTS`;
  if (rest === 0) return hundredsWord;
  return `${hundreds === 1 ? 'CENT' : `${ONES[hundreds]} CENT`} ${convertHundreds(rest)}`;
}

function convertThousands(n: number): string {
  if (n === 0) return 'ZÉRO';
  let result = '';
  if (n >= 1_000_000) {
    const millions = Math.floor(n / 1_000_000);
    result += `${millions === 1 ? 'UN MILLION' : `${convertHundreds(millions)} MILLIONS`} `;
    n %= 1_000_000;
  }
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    result += `${thousands === 1 ? 'MILLE' : `${convertHundreds(thousands)} MILLE`} `;
    n %= 1000;
  }
  result += convertHundreds(n);
  return result.trim();
}

export function amountToWordsTND(amount: number): string {
  const dinars = Math.floor(amount);
  const millimes = Math.round((amount - dinars) * 1000);

  const dinarText = convertThousands(dinars);
  const dinarWord = dinars <= 1 ? 'DINAR' : 'DINARS';

  if (millimes === 0) {
    return `${dinarText} ${dinarWord}`;
  }

  const millimesText = convertThousands(millimes);
  const millimeWord = millimes <= 1 ? 'MILLIME' : 'MILLIMES';

  return `${dinarText} ${dinarWord}, ${millimesText} ${millimesText === 'ZÉRO' ? '' : millimeWord}`.trim();
}