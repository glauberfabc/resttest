import MenuPageClient from "@/components/menu/page-client";
import { menuItems } from "@/lib/data";

export default function MenuPage() {
  return <MenuPageClient initialMenuItems={menuItems} />;
}
