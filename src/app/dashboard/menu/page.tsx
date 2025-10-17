
import MenuPageClient from "@/components/menu/page-client";
import { getMenuItems, getCurrentUser } from "@/lib/user-actions";

export default async function MenuPage() {
  await getCurrentUser(); // Protect route
  const menuItems = await getMenuItems();
  return <MenuPageClient initialMenuItems={menuItems} />;
}
