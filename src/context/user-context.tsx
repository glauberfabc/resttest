
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
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
  logout: () => Promise<void>;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    // Get the initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            name: profile.name,
            role: profile.role as UserRole,
          });
        }
      }
      setLoading(false);
    });

    // Set up the auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setLoading(true);
        if (session) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile.name,
              role: profile.role as UserRole,
            });
             if (event === 'SIGNED_IN') {
              router.push('/dashboard');
            }
          } else {
            // This case should ideally not happen if signup is correct
            // If it does, sign out to prevent inconsistent state
            await supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const login = async (credentials: { email: string; password?: string }) => {
    setLoading(true);
    const { email, password } = credentials;
    if (!password) {
       toast({ variant: 'destructive', title: "Login falhou", description: "A senha é obrigatória." });
       setLoading(false);
       return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login failed:", error.message);
        toast({ variant: 'destructive', title: "Erro no Login", description: "Credenciais inválidas. Verifique seu e-mail e senha." });
    }
    // onAuthStateChange will handle success and navigation.
    setLoading(false);
  };

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    setLoading(true);
    const { name, email, password } = credentials;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError.message);
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: signUpError.message });
      setLoading(false);
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
            // This requires admin privileges which we don't have on the client, but it's a good practice to try
            await supabase.auth.admin.deleteUser(signUpData.user.id).catch(() => {});
            await supabase.auth.signOut();
        } else {
            toast({ title: 'Cadastro realizado!', description: 'Faça o login para continuar.' });
            router.push('/');
        }
    }
    setLoading(false);
  };


  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
  };

  return (
    <UserContext.Provider value={{ user, login, signup, logout, loading }}>
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
