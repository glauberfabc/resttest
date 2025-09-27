import InventoryPageClient from "@/components/inventory/page-client";
import { getMenuItems } from "@/lib/supabase";

export default async function InventoryPage() {
  const items = await getMenuItems();
  return <InventoryPageClient initialMenuItems={items} />;
}
