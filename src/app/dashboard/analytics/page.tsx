import AnalyticsPageClient from "@/components/dashboard/analytics-page-client";
import { getOrders, getMenuItems } from "@/lib/supabase";

export default async function AnalyticsPage() {
    const orders = await getOrders();
    const items = await getMenuItems();
    return <AnalyticsPageClient orders={orders} menuItems={items} />;
}
