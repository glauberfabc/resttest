'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import type { User, UserRole, Order, MenuItem, Client, ClientCredit } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function getCurrentUser(): Promise<User | null> {
    console.log("[USER_ACTIONS] getCurrentUser: Iniciando verificação de usuário no servidor...");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        console.log("[USER_ACTIONS] getCurrentUser: Nenhuma sessão encontrada. Redirecionando para a página de login.");
        return null;
    }
    
    console.log("[USER_ACTIONS] getCurrentUser: Sessão encontrada para o usuário ID:", user.id);

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();
    
    if (!profile) {
        console.error("[USER_ACTIONS] getCurrentUser: Erro crítico! Usuário tem sessão mas não tem perfil. Deslogando.");
        // In a real app, you might want to handle this more gracefully
        // For now, we'll prevent login.
        return null;
    }

    console.log("[USER_ACTIONS] getCurrentUser: Perfil do usuário encontrado:", profile);

    return {
        id: user.id,
        email: user.email!,
        name: profile.name,
        role: profile.role as UserRole,
    };
}

export async function getMenuItems(): Promise<MenuItem[]> {
    const supabase = await createClient();
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
    const supabase = await createClient();
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
    const supabase = await createClient();

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
    const supabase = await createClient();
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
