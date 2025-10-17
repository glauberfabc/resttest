

import { createClient } from '@supabase/supabase-js'
import type { Order, MenuItem, Client, ClientCredit, User } from './types';
import { Database } from './database.types';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL and/or anonymous key are not set. This is expected during build, but will cause errors in production if not set.');
}


export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
    return data.map(item => ({ ...item, id: item.id || crypto.randomUUID(), code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
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

export async function getOrders(user: User | null): Promise<Order[]> {
    if (!user) return [];

    let query = supabase
        .from('orders')
        .select(`
            *,
            items:order_items (
                id,
                quantity,
                comment,
                menu_item_id,
                menu_item:menu_items (
                    *
                )
            ),
            payments:order_payments (*)
        `);
    
    // Admins can see all orders, collaborators only see their own
    if (user.role === 'collaborator') {
        query = query.eq('user_id', user.id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error.message);
        return [];
    }

    // Remap data to match frontend type expectations
    return data.map(order => ({
        ...order,
        items: order.items.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            quantity: item.quantity,
            comment: item.comment || '',
            menuItem: {
                ...item.menu_item,
                id: item.menu_item.id || crypto.randomUUID(),
                imageUrl: item.menu_item.image_url,
                lowStockThreshold: item.menu_item.low_stock_threshold,
            }
        })),
        created_at: new Date(order.created_at), // Convert string to Date object
        paid_at: order.paid_at ? new Date(order.paid_at) : undefined, // Convert string to Date object
        // Compatibility props
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
    })) as unknown as Order[];
}


export async function getClientCredits(): Promise<ClientCredit[]> {
    const { data, error } = await supabase
        .from('client_credits')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error('Error fetching client credits:', error);
        return [];
    }
    return data.map(credit => ({
        ...credit,
        created_at: new Date(credit.created_at)
    })) as ClientCredit[];
}

// NOTE: getCurrentUserOnServer has been moved to src/lib/user-actions.ts to avoid server-only imports in this file.
