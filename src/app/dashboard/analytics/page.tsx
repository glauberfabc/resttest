import AnalyticsPageClient from "@/components/dashboard/analytics-page-client";
import { initialOrders, menuItems } from "@/lib/data";
import type { Order, MenuItem } from "@/lib/types";

async function getOrders(): Promise<Order[]> {
    // In a real app, you would fetch this from a database or API
    return Promise.resolve(initialOrders);
}

async function getMenuItems(): Promise<MenuItem[]> {
    // In a real app, you would fetch this from a database
    return Promise.resolve(menuItems);
}

export default async function AnalyticsPage() {
    const orders = await getOrders();
    const items = await getMenuItems();
    return <AnalyticsPageClient orders={orders} menuItems={items} />;
}
