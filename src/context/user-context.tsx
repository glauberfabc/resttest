
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
    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      const supabaseUser = session?.user;

      if (!supabaseUser) {
        setUser(null);
        if (pathname !== '/' && pathname !== '/signup') {
          router.push('/');
        }
        return;
      }

      // Check if user is already set to avoid unnecessary fetches
      if (user?.id === supabaseUser.id) {
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', supabaseUser.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError.message);
        toast({ variant: 'destructive', title: "Erro de Perfil", description: "Não foi possível carregar seu perfil." });
        await supabase.auth.signOut();
        setUser(null);
        router.push('/');
      } else if (profile) {
        const userData: User = {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profile.name,
          role: profile.role as UserRole,
        };
        setUser(userData);
        if (pathname === '/' || pathname === '/signup') {
          router.push('/dashboard');
        }
      } else {
        console.error("Profile not found for user:", supabaseUser.id);
        toast({ variant: 'destructive', title: 'Perfil não encontrado', description: 'Seu perfil não foi encontrado. Tente fazer login novamente.' });
        await supabase.auth.signOut();
        setUser(null);
        router.push('/');
      }
    };
    
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            handleAuthChange('INITIAL_SESSION', session);
        }
    });


    const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      authListener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // The onAuthStateChange listener will handle the redirect and state update
  };

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    const { name, email, password } = credentials;

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
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: signUpData.user.id,
                name: name,
                role: 'collaborator' // Default role
            });

        if (profileError) {
            console.error('Error creating profile:', profileError.message);
            toast({ variant: 'destructive', title: 'Erro Crítico', description: 'A conta foi criada, mas o perfil não. Contate o suporte.' });
            
            // Clean up the user if profile creation fails.
            // This requires admin privileges and is best handled server-side.
            // We sign out the user as a safety measure.
            await supabase.auth.signOut();
            return;
        }

        toast({ title: 'Cadastro realizado!', description: 'Faça o login para continuar.' });
        router.push('/');
    }
  };


  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
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
