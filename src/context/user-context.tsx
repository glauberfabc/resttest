
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';


type UserRole = 'admin' | 'collaborator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  login: (credentials: { email: string; password?: string }) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user;
        if (currentUser) {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('name, role')
                .eq('id', currentUser.id)
                .single();

            if (error) {
                console.error("Error fetching profile:", error.message);
                toast({
                  variant: 'destructive',
                  title: 'Erro ao buscar perfil',
                  description: 'Não foi possível carregar os dados do usuário. O perfil pode não existir ou haver um problema de permissão.'
                });
                await supabase.auth.signOut();
                setUser(null);
                router.push('/');
            } else if (profile) {
                const userData: User = {
                    id: currentUser.id,
                    email: currentUser.email!,
                    name: profile.name,
                    role: profile.role as UserRole,
                };
                setUser(userData);
                if(window.location.pathname === '/') {
                  router.push('/dashboard/analytics');
                }
            } else {
                 console.error("Login successful but no profile found for user:", currentUser.id);
                 toast({
                    variant: 'destructive',
                    title: 'Perfil não encontrado',
                    description: 'Seu usuário existe, mas não há um perfil associado. Contate o suporte.'
                 });
                 await supabase.auth.signOut();
                 setUser(null);
            }
        } else {
            setUser(null);
            if (window.location.pathname !== '/') {
                router.push('/');
            }
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
  }, [router, toast]);

  const login = async (credentials: { email: string; password?: string }) => {
    const { email, password } = credentials;
    if (!password) {
       toast({ variant: 'destructive', title: "Login falhou", description: "A senha é obrigatória." });
       return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login failed:", error.message);
        toast({ variant: 'destructive', title: "Erro no Login", description: error.message });
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
       console.error("Logout failed:", error.message);
       toast({ variant: 'destructive', title: "Erro ao sair", description: error.message });
    } else {
      setUser(null);
      router.push('/');
    }
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
