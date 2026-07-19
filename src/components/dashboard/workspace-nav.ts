import type { BusinessType } from "@/lib/business-types";

export type WorkspaceNavItem = {
  label: string;
  slug: string;
  short: string;
  /** Shown only for mobile shop workspaces. */
  mobileOnly?: boolean;
  /** Shown only for restaurant workspaces. */
  restaurantOnly?: boolean;
  /** Shown only for grocery workspaces. */
  groceryOnly?: boolean;
};

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "Overview", slug: "", short: "Home" },
  { label: "Daily Entry", slug: "daily-entry", short: "Entry" },
  { label: "Day review", slug: "day-review", short: "Review" },
  { label: "Transactions", slug: "transactions", short: "Ledger" },
  { label: "Reports", slug: "reports", short: "Reports" },
  { label: "Total profit", slug: "total-profit", short: "Profit", mobileOnly: true },
  { label: "Notes +", slug: "notebook", short: "Notes+" },
  { label: "Notebook", slug: "ledger", short: "Book" },
  { label: "Notes", slug: "notes", short: "Notes" },
  { label: "Extras", slug: "extras", short: "Extras", mobileOnly: true },
  { label: "Cash expenses", slug: "cash-expenses", short: "Cash" },
  { label: "Bank expenses", slug: "bank-expenses", short: "Bank" },
  { label: "Purchases & Spesa", slug: "spesa", short: "Spesa", restaurantOnly: true },
  { label: "Expenses", slug: "grocery-expenses", short: "Expenses", groceryOnly: true },
  { label: "Cheques", slug: "grocery-cheques", short: "Cheques", groceryOnly: true },
  { label: "Settings", slug: "settings", short: "More" },
];

export function workspaceNavForBusiness(businessType: BusinessType): WorkspaceNavItem[] {
  return WORKSPACE_NAV.filter((item) => {
    if (item.mobileOnly && businessType !== "mobile_shop") return false;
    if (item.restaurantOnly && businessType !== "restaurant") return false;
    if (item.groceryOnly && businessType !== "grocery") return false;
    return true;
  });
}
