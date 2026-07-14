import { GroceryExpensesPage } from "@/components/dashboard/grocery-expenses-page";

export default function GroceryExpensesRoutePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <GroceryExpensesPage params={params} />;
}
