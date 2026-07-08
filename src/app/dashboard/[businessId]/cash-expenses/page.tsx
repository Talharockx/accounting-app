import { MobileDetailLinesPage } from "@/components/dashboard/mobile-detail-lines-page";

export default function CashExpensesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <MobileDetailLinesPage params={params} kind="cash_expenses" />;
}
