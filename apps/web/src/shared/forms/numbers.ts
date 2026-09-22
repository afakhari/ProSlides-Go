const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const normalizeDigits = (value: string): string =>
  value
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));

export const normalizeNumericInput = (value: string): string =>
  normalizeDigits(value)
    .replace(/[٬،,\s]/g, "")
    .replace("٫", ".");

export const parseLocalizedNumber = (value: string): number | null => {
  const normalized = normalizeNumericInput(value).trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

export const formatPersianNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
): string => new Intl.NumberFormat("fa-IR", options).format(value);
