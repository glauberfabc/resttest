import MenuPageClient from "@/components/menu/page-client";
import { getMenuItems } from "@/lib/supabase";

export default async function MenuPage() {
  const menuItems = await getMenuItems();
  return <MenuPageClient initialMenuItems={menuItems} />;
}
