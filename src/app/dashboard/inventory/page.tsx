
import InventoryPageClient from "@/components/inventory/page-client";
import { menuItems } from "@/lib/data";
import type { MenuItem } from "@/lib/types";

async function getMenuItems(): Promise<MenuItem[]> {
    // In a real app, you would fetch this from a database
    return Promise.resolve(menuItems);
}

export default async function InventoryPage() {
  const items = await getMenuItems();
  return <InventoryPageClient initialMenuItems={items} />;
}
