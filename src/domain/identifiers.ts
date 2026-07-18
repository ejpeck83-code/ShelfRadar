import type { IdentifierKind } from "./catalog";

const GTIN_KINDS = new Set<IdentifierKind>(["UPC", "GTIN12", "GTIN13", "EAN"]);

export type NormalizedIdentifier = {
  kind: IdentifierKind;
  valueNormalized: string;
  valueDisplay: string;
  valid: boolean;
};

export function hasValidGtinCheckDigit(value: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const check = digits.pop();
  if (check === undefined) return false;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function normalizeIdentifier(kind: IdentifierKind, displayValue: string): NormalizedIdentifier {
  const valueDisplay = displayValue.trim();
  if (GTIN_KINDS.has(kind)) {
    const digits = valueDisplay.replace(/\D/g, "");
    return { kind, valueNormalized: digits, valueDisplay, valid: hasValidGtinCheckDigit(digits) };
  }
  if (kind === "DPCI") {
    const digits = valueDisplay.replace(/\D/g, "");
    return { kind, valueNormalized: digits, valueDisplay, valid: digits.length === 8 || digits.length === 9 };
  }
  const normalized = valueDisplay.toUpperCase().replace(/\s+/g, "");
  return { kind, valueNormalized: normalized, valueDisplay, valid: normalized.length > 0 };
}

export function identifierNamespace(kind: IdentifierKind, retailerKey?: string): string {
  if (["DPCI", "TCIN", "WALMART_ITEM_ID", "MEIJER_SKU", "RETAILER_SKU"].includes(kind)) {
    return `${retailerKey ?? "unknown"}:${kind}`;
  }
  return `global:${kind}`;
}
