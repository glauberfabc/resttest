
import InventoryPageClient from "@/components/inventory/page-client";
import { getMenuItems, getCurrentUser } from "@/lib/user-actions";

export default async function InventoryPage() {
  await getCurrentUser(); // Protect route
  const items = await getMenuItems();
  return <InventoryPageClient initialMenuItems={items} />;
}
