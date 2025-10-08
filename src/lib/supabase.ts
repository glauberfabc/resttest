
import { createClient } from '@supabase/supabase-js'
import type { Order, MenuItem, Client } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and/or anonymous key are not set. This is expected during build, but will cause errors in production if not set.');
}


export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        detectSessionInUrl: true,
        autoRefreshToken: true,
    },
     db: {
        schema: 'public',
    }
});


// Service functions to fetch data

export async function getMenuItems(): Promise<MenuItem[]> {
    const { data, error } = await supabase
        .from('menu_items')
        .select('*');

    if (error) {
        console.error('Error fetching menu items:', error);
        return [];
    }
    // TODO: This is a temporary hack to match frontend expectations. We should align data sources.
    return data.map(item => ({ ...item, code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
}

export async function getClients(): Promise<Client[]> {
    const { data, error } = await supabase
        .from('clients')
        .select('*');
    
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    return data as Client[];
}

export async function getOrders(): Promise<Order[]> {
    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            items:order_items (
                id,
                quantity,
                comment,
                menu_item:menu_items (
                    *
                )
            ),
            payments:order_payments (*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error.message);
        return [];
    }

    // Remap data to match frontend type expectations
    return data.map(order => ({
        ...order,
        items: order.items.map((item: any) => ({
            id: item.id,
            quantity: item.quantity,
            comment: item.comment || '',
            menuItem: {
                ...item.menu_item,
                imageUrl: item.menu_item.image_url,
                lowStockThreshold: item.menu_item.low_stock_threshold,
            }
        })),
        createdAt: order.created_at,
        paidAt: order.paid_at
    })) as unknown as Order[];
}
