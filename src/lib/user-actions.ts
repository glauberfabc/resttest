
import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { User } from '@/lib/types';
import { redirect } from 'next/navigation';

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
            },
        }
    );

    const { data: { session }, } = await supabase.auth.getSession();
    const supabaseUser = session?.user;

    if (!supabaseUser) {
        // This is a server component, so we can redirect here
        redirect('/');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', supabaseUser.id)
        .single();
    
    if (!profile) {
        // Handle case where profile doesn't exist for a logged in user
        // This might happen if profile creation fails
        await supabase.auth.signOut();
        redirect('/');
    }

    return {
        id: supabaseUser.id,
        email: supabaseUser.email!,
        name: profile.name,
        role: profile.role,
    };
}
