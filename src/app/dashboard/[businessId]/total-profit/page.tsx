import { MobileTotalProfitPage } from "@/components/dashboard/mobile-total-profit-page";

export default function TotalProfitPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <MobileTotalProfitPage params={params} />;
}
