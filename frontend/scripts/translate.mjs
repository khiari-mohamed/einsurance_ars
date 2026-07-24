// Auto-translates src/locales/fr.json into en/ar/zh via LibreTranslate.
// Only translates new keys; existing translations are preserved unless --force is used.

import fs from 'fs/promises';
import path from 'path';

const LOCALES_DIR = path.resolve('src/locales');
const SOURCE_LANG = 'fr';
const TARGET_LANGS = ['en', 'ar', 'zh'];
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL ?? 'https://translate.astian.org/translate';
const MAX_ATTEMPTS = 2;
const TRANSLATE_TIMEOUT_MS = Number(process.env.I18N_TIMEOUT_MS ?? 8000);
const DEFAULT_CONCURRENCY = Number(process.env.I18N_CONCURRENCY ?? 4);
const MAX_STRINGS = parseMaxStringsArg(process.argv.slice(2));
const LANG_CODE_MAP = { fr: 'fr', en: 'en', ar: 'ar', zh: 'zh' };

function parseMaxStringsArg(argv) {
  const valueArg = argv.find((arg) => arg.startsWith('--max-strings='));
  if (valueArg) {
    return Number(valueArg.split('=')[1]);
  }

  const index = argv.indexOf('--max-strings');
  if (index >= 0 && argv[index + 1]) {
    return Number(argv[index + 1]);
  }

  return Number(process.env.I18N_MAX_STRINGS ?? 0);
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, fullKey));
    } else {
      out[fullKey] = value;
    }
  }
  return out;
}

function unflatten(flat) {
  const out = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cursor = out;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] = cursor[parts[i]] || {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return out;
}

async function translateText(text, targetLang) {
  const normalizedText = text.trim();
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(LIBRETRANSLATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: normalizedText,
          source: LANG_CODE_MAP[SOURCE_LANG],
          target: LANG_CODE_MAP[targetLang],
          format: 'text',
        }),
        signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`LibreTranslate error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return data.translatedText;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  try {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: LANG_CODE_MAP[SOURCE_LANG],
      tl: LANG_CODE_MAP[targetLang],
      dt: 't',
      q: normalizedText,
    });
    const fallbackResponse = await fetch(
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
      { signal: AbortSignal.timeout(TRANSLATE_TIMEOUT_MS) },
    );
    if (!fallbackResponse.ok) {
      throw new Error(`Fallback translation error ${fallbackResponse.status}`);
    }
    const fallbackData = await fallbackResponse.json();
    const translated = fallbackData?.[0]
      ?.map((segment) => segment?.[0] ?? '')
      .join('')
      .trim();
    if (!translated) throw new Error('Fallback returned no translation');
    return translated;
  } catch (fallbackError) {
    throw new Error(`${lastError?.message ?? 'LibreTranslate failed'}; fallback failed: ${fallbackError.message}`);
  }
}

async function loadJson(file) {
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function processTranslations({ sourceFlat, targetFlat, targetLang, forceRetranslate, maxStrings, concurrency }) {
  const entries = Object.entries(sourceFlat).filter(([, sourceText]) => typeof sourceText === 'string' && sourceText.trim() !== '');
  const totalToProcess = maxStrings > 0 ? Math.min(maxStrings, entries.length) : entries.length;
  const selectedEntries = entries.slice(0, totalToProcess);

  let translatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  if (selectedEntries.length === 0) {
    return { translatedCount, skippedCount, failedCount };
  }

  console.log(`[${targetLang}] processing ${selectedEntries.length} strings (concurrency ${concurrency})`);

  const results = new Array(selectedEntries.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, selectedEntries.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= selectedEntries.length) return;

      const [key, sourceText] = selectedEntries[currentIndex];
      const hasTranslation = targetFlat[key] && targetFlat[key] !== sourceText;
      if (hasTranslation && !forceRetranslate) {
        results[currentIndex] = { key, value: targetFlat[key], status: 'skipped' };
        continue;
      }

      try {
        const translated = await translateText(sourceText, targetLang);
        results[currentIndex] = { key, value: translated, status: 'translated' };
      } catch (err) {
        console.error(`Failed "${key}" -> ${targetLang}:`, err.message);
        results[currentIndex] = { key, value: sourceText, status: 'failed' };
      }
    }
  });

  await Promise.all(workers);

  for (const result of results) {
    if (!result) continue;
    targetFlat[result.key] = result.value;
    if (result.status === 'translated') translatedCount++;
    else if (result.status === 'skipped') skippedCount++;
    else failedCount++;
  }

  return { translatedCount, skippedCount, failedCount };
}

async function main() {
  const sourcePath = path.join(LOCALES_DIR, `${SOURCE_LANG}.json`);
  const sourceRaw = await loadJson(sourcePath);
  const sourceFlat = flatten(sourceRaw);
  const forceRetranslate = process.argv.includes('--force');
  const concurrency = Number(process.env.I18N_CONCURRENCY ?? DEFAULT_CONCURRENCY);

  for (const targetLang of TARGET_LANGS) {
    const targetPath = path.join(LOCALES_DIR, `${targetLang}.json`);
    const targetRaw = await loadJson(targetPath);
    const targetFlat = flatten(targetRaw);

    const { translatedCount, skippedCount, failedCount } = await processTranslations({
      sourceFlat,
      targetFlat,
      targetLang,
      forceRetranslate,
      maxStrings: MAX_STRINGS,
      concurrency,
    });

    for (const key of Object.keys(targetFlat)) {
      if (!(key in sourceFlat)) delete targetFlat[key];
    }

    const targetNested = unflatten(targetFlat);
    await fs.writeFile(targetPath, JSON.stringify(targetNested, null, 2) + '\n', 'utf-8');
    console.log(`[${targetLang}] translated: ${translatedCount}, skipped (already done): ${skippedCount}, failed: ${failedCount}`);
  }

  if (MAX_STRINGS > 0) {
    console.log(`\nDone. Limited to ${MAX_STRINGS} strings per run. Re-run without --max-strings for a full pass.`);
  } else {
    console.log('\nDone. Re-run with --force to re-translate everything.');
  }
}

main().catch((err) => {
  console.error('Translation script failed:', err);
  process.exit(1);
});
