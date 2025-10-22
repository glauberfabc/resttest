
import UsersPageClient from "@/components/dashboard/users/page-client";
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "@/lib/user-actions";
import { redirect } from 'next/navigation';
import type { User } from "@/lib/types";

export default async function UsersPage() {
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
        redirect('/dashboard');
    }

    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('*');

    if (error) {
        console.error("Error fetching users:", error);
        // Fallback or error display
        return <div>Erro ao carregar usuários.</div>;
    }
    
    const users = data as User[];

    return <UsersPageClient initialUsers={users} currentUser={currentUser} />;
}
