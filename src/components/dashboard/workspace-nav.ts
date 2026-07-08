import type { BusinessType } from "@/lib/business-types";

export type WorkspaceNavItem = {
  label: string;
  slug: string;
  short: string;
  /** Shown only for mobile shop workspaces. */
  mobileOnly?: boolean;
};

export const WORKSPACE_NAV: WorkspaceNavItem[] = [
  { label: "Overview", slug: "", short: "Home" },
  { label: "Daily Entry", slug: "daily-entry", short: "Entry" },
  { label: "Day review", slug: "day-review", short: "Review" },
  { label: "Transactions", slug: "transactions", short: "Ledger" },
  { label: "Reports", slug: "reports", short: "Reports" },
  { label: "Total profit", slug: "total-profit", short: "Profit", mobileOnly: true },
  { label: "Notes", slug: "notes", short: "Notes" },
  { label: "Extras", slug: "extras", short: "Extras", mobileOnly: true },
  { label: "Cash expenses", slug: "cash-expenses", short: "Cash", mobileOnly: true },
  { label: "Bank expenses", slug: "bank-expenses", short: "Bank", mobileOnly: true },
  { label: "Settings", slug: "settings", short: "More" },
];

export function workspaceNavForBusiness(businessType: BusinessType): WorkspaceNavItem[] {
  return WORKSPACE_NAV.filter((item) => !item.mobileOnly || businessType === "mobile_shop");
}
