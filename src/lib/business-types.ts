export const BUSINESS_TYPES = ["restaurant", "mobile_shop", "grocery"] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export type ReportsBusinessType = BusinessType;

export function normalizeBusinessType(raw: unknown): BusinessType | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (t === "restaurant") return "restaurant";
  if (t === "mobile_shop") return "mobile_shop";
  if (t === "mobile" || t === "mobileshop" || t === "phone_shop" || t === "phoneshop") return "mobile_shop";
  if (t === "grocery" || t === "groceries" || t === "grocery_store") return "grocery";
  return null;
}

export function businessTypeLabel(type: BusinessType): string {
  if (type === "restaurant") return "Restaurant";
  if (type === "mobile_shop") return "Mobile shop";
  return "Grocery";
}

export function businessTypePlural(type: BusinessType): string {
  if (type === "restaurant") return "restaurants";
  if (type === "mobile_shop") return "mobile shops";
  return "grocery stores";
}

export function businessTypeName(type: BusinessType): string {
  if (type === "restaurant") return "restaurant";
  if (type === "mobile_shop") return "mobile shop";
  return "grocery store";
}
