
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async (currentUser: SupabaseUser) => {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name, role')
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
            if(window.location.pathname === '/' || window.location.pathname === '/signup') {
              router.push('/dashboard');
            }
        } else {
             console.error("Profile not found for user:", currentUser.id);
             toast({
              variant: 'destructive',
              title: 'Perfil não encontrado',
              description: 'Sua conta de autenticação existe, mas seu perfil de usuário não. Tentando deslogar.'
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
            if (window.location.pathname !== '/' && window.location.pathname !== '/signup') {
                router.push('/');
            }
        } else if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
            fetchUser(currentUser);
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
    // onAuthStateChange listener will handle the rest
  };

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    const { name, email, password } = credentials;

    const { error: signUpError } = await supabase.auth.signUp({
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
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: signUpError.message });
      return;
    }
    
    // The onAuthStateChange listener will now handle fetching the profile.
    toast({ title: 'Cadastro realizado com sucesso!', description: 'Bem-vindo!' });
  };


  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
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
