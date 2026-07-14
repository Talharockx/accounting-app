import { RestaurantSpesaPage } from "@/components/dashboard/restaurant-spesa-page";

export default function SpesaPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <RestaurantSpesaPage params={params} />;
}
