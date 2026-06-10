import { BusinessDashboardShell } from "@/components/dashboard/business-dashboard-shell";

export const dynamic = "force-dynamic";

export default function BusinessDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BusinessDashboardShell>{children}</BusinessDashboardShell>;
}
