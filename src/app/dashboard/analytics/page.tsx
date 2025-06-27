import AnalyticsPageClient from "@/components/dashboard/analytics-page-client";
import { initialOrders } from "@/lib/data";
import type { Order } from "@/lib/types";

async function getOrders(): Promise<Order[]> {
    // In a real app, you would fetch this from a database or API
    return Promise.resolve(initialOrders);
}

export default async function AnalyticsPage() {
    const orders = await getOrders();
    return <AnalyticsPageClient orders={orders} />;
}
