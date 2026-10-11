export function stripHarakat(value = '') {
  return String(value).normalize('NFKC').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').replace(/ـ/g, '');
}

export function normalizeArabic(value = '') {
  return stripHarakat(value)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('id-ID');
}

export function normalizeText(value = '') {
  return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('id-ID').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function wordSearchBlob(word) {
  return [normalizeArabic(word.ar), normalizeText(word.latin), normalizeText(word.id_text), normalizeText(word.category), ...(word.tags || []).map(normalizeText)].join(' ');
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
