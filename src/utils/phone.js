export function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  let clean = phone.replace(/\D/g, '');
  // Replace leading 08 with 628
  if (clean.startsWith('08')) {
    clean = '628' + clean.slice(2);
  }
  // If starts with 8, prepend 62
  if (clean.startsWith('8') && clean.length >= 9) {
    clean = '62' + clean;
  }
  return clean;
}
