import { MobileDetailLinesPage } from "@/components/dashboard/mobile-detail-lines-page";

export default function ExtrasPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  return <MobileDetailLinesPage params={params} kind="extras" />;
}
