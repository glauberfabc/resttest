
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
    const fetchUser = async (currentUser: SupabaseUser | null) => {
        if (!currentUser) {
            setUser(null);
            if (pathname !== '/' && pathname !== '/signup') {
                router.push('/');
            }
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, role')
            .eq('id', currentUser.id)
            .limit(1)
            .maybeSingle();

        if (profileError) {
            console.error("Error fetching profile:", profileError.message);
            toast({ variant: 'destructive', title: "Erro ao buscar perfil", description: profileError.message });
            await supabase.auth.signOut();
            setUser(null);
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
              description: 'Seu perfil de usuário não foi encontrado. Por favor, deslogue e logue novamente ou crie uma nova conta.'
            });
            await supabase.auth.signOut();
            setUser(null);
        }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUser(session?.user || null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        fetchUser(session?.user || null);
      }
    );

    return () => {
        authListener?.subscription.unsubscribe();
    };
  }, [pathname, router, toast]);

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

    // First, sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError.message);
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: "Não foi possível criar o usuário." });
      return;
    }
    
    if (signUpData.user) {
        // Now, create the profile for the new user
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: signUpData.user.id,
                name: name,
                role: 'collaborator' // Default role for new signups
            });

        if (profileError) {
            console.error('Error creating profile:', profileError.message);
            toast({ variant: 'destructive', title: 'Erro Crítico', description: 'A conta foi criada, mas o perfil não. Contate o suporte.' });
            
            // Optional: try to delete the newly created user for consistency
            // This requires admin privileges, which we don't have on the client-side.
            // await supabase.auth.admin.deleteUser(signUpData.user.id)
            
            return;
        }

        toast({ title: 'Cadastro realizado com sucesso!', description: 'Bem-vindo! Faça o login para continuar.' });
        router.push('/');
    }
  };


  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error && error.message !== 'Auth session missing!') {
       console.error("Logout failed:", error.message);
       toast({ variant: 'destructive', title: "Erro ao sair", description: error.message });
    } else {
      setUser(null);
      router.push('/');
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
