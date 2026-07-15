import { GroceryChequesPage } from "@/components/dashboard/grocery-cheques-page";

export default function GroceryChequesRoutePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <GroceryChequesPage params={params} />;
}
