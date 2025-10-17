
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { User, UserRole } from '@/lib/types';
import { redirect } from 'next/navigation';
import { Database } from './database.types';

export async function getCurrentUser(): Promise<User | null> {
    const supabase = createServerComponentClient<Database>({ cookies });

    const { data: { session }, } = await supabase.auth.getSession();
    
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
