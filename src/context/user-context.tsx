
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';


type UserRole = 'admin' | 'collaborator';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  login: (credentials: { email: string; password?: string }) => Promise<void>;
  signup: (credentials: SignUpWithPasswordCredentials & { name: string }) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async (currentUser: SupabaseUser) => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, role')
            .eq('id', currentUser.id)
            .limit(1)
            .maybeSingle();

        if (profileError) {
            console.error("Error fetching profile after login:", profileError.message);
            toast({ variant: 'destructive', title: "Erro ao buscar perfil", description: profileError.message });
            await supabase.auth.signOut();
        } else if (profile) {
            const userData: User = {
                id: currentUser.id,
                email: currentUser.email!,
                name: profile.name,
                role: profile.role as UserRole,
            };
            setUser(userData);
            if ((pathname === '/' || pathname === '/signup') && !pathname.startsWith('/dashboard')) {
                router.push('/dashboard');
            }
        } else {
             console.error("Profile not found for user:", currentUser.id);
             toast({
              variant: 'destructive',
              title: 'Perfil não encontrado',
              description: 'Seu perfil de usuário não foi encontrado. Por favor, tente deslogar e logar novamente.'
            });
            await supabase.auth.signOut();
            setUser(null);
        }
    }


    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchUser(session.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        const currentUser = session?.user;
        
        if (event === 'SIGNED_OUT') {
            setUser(null);
            if (pathname !== '/' && pathname !== '/signup') {
                router.push('/');
            }
        } else if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
            // Check if the user state is already set to avoid redundant fetches
            if (!user || user.id !== currentUser.id) {
                fetchUser(currentUser);
            }
        }
    });

    return () => {
        authListener.subscription.unsubscribe();
    };
  }, [router, toast, pathname, user]);

  const login = async (credentials: { email: string; password?: string }) => {
    const { email, password } = credentials;
    if (!password) {
       toast({ variant: 'destructive', title: "Login falhou", description: "A senha é obrigatória." });
       return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login failed:", error.message);
        toast({ variant: 'destructive', title: "Erro no Login", description: "Credenciais inválidas. Verifique seu e-mail e senha." });
    }
  };

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    const { name, email, password } = credentials;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
            name: name
        }
      }
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError.message);
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: "Não foi possível criar o usuário." });
      return;
    }
    
    // The profile is now created by the database trigger, so we don't need to do it here.
    
    if (signUpData.user) {
        toast({ title: 'Cadastro realizado com sucesso!', description: 'Bem-vindo! Faça o login para continuar.' });
        router.push('/');
    }
  };


  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && error.message !== 'Auth session missing!') {
       console.error("Logout failed:", error.message);
       toast({ variant: 'destructive', title: "Erro ao sair", description: error.message });
    }
  };

  return (
    <UserContext.Provider value={{ user, login, signup, logout }}>
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
