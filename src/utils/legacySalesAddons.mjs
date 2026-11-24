const LEGACY_FAST_TRACK_CODES = new Set(['SRV-FAST-TRACK', 'FAST-TRACK'])
const LEGACY_TWO_COLOR_CODES = new Set(['SRV-2-WARNA', 'BIAYA-WARNA'])

const normalizeProductCode = (productCode) => String(productCode || '').trim().toUpperCase()

export const isLegacyFastTrackCode = (productCode) => LEGACY_FAST_TRACK_CODES.has(normalizeProductCode(productCode))
export const isLegacyTwoColorCode = (productCode) => LEGACY_TWO_COLOR_CODES.has(normalizeProductCode(productCode))
export const isLegacySalesAddonCode = (productCode) => (
  isLegacyFastTrackCode(productCode) || isLegacyTwoColorCode(productCode)
)
