import AnalyticsPageClient from "@/components/dashboard/analytics-page-client";
import { getOrders, getMenuItems } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/user-actions";

export default async function AnalyticsPage() {
    const user = await getCurrentUser();

    if (!user) return null;

    const orders = await getOrders(user);
    const items = await getMenuItems();
    return <AnalyticsPageClient orders={orders} menuItems={items} user={user} />;
}
