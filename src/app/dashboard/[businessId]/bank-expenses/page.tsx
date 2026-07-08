import { MobileDetailLinesPage } from "@/components/dashboard/mobile-detail-lines-page";

export default function BankExpensesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <MobileDetailLinesPage params={params} kind="bank_expenses" />;
}
