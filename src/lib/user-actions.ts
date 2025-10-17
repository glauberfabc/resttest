
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User, UserRole, Order, MenuItem, Client, ClientCredit } from '@/lib/types';
import { redirect } from 'next/navigation';
import { Database } from './database.types';

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = cookies();

    const supabase = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (error) {
                        // The `set` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (error) {
                        // The `delete` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        redirect('/');
    }
    
    const supabaseUser = session.user;

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', supabaseUser.id)
        .single();
    
    if (!profile) {
        // This case should ideally not happen if profile is created on signup
        // But as a fallback, we sign out and redirect.
        await supabase.auth.signOut();
        redirect('/');
    }

    return {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: profile.name,
        role: profile.role as UserRole,
    };
}


// Server-side data fetching functions

const createSupabaseServerClient = () => {
    const cookieStore = cookies();
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );
};


export async function getMenuItems(): Promise<MenuItem[]> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('menu_items')
        .select('*');

    if (error) {
        console.error('Error fetching menu items:', error);
        return [];
    }
    return data.map(item => ({ ...item, id: item.id || crypto.randomUUID(), code: item.code, imageUrl: item.image_url, lowStockThreshold: item.low_stock_threshold })) as unknown as MenuItem[];
}

export async function getClients(): Promise<Client[]> {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from('clients')
        .select('*');
    
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    return data as Client[];
}

export async function getOrders(user: User): Promise<Order[]> {
    const supabase = createSupabaseServerClient();

    let query = supabase
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
        `);
    
    // In a real app, you'd filter by user ID or role
    // if (user.role === 'collaborator') {
    //     query = query.eq('user_id', user.id);
    // }
    
    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching orders:', error.message);
        return [];
    }

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
        created_at: new Date(order.created_at),
        paid_at: order.paid_at ? new Date(order.paid_at) : undefined,
        createdAt: new Date(order.created_at),
        paidAt: order.paid_at ? new Date(order.paid_at) : undefined,
    })) as unknown as Order[];
}


export async function getClientCredits(): Promise<ClientCredit[]> {
    const supabase = createSupabaseServerClient();
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
