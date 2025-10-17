
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  logout: () => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      setLoading(true);
      const supabaseUser = session?.user;
      
      const publicPages = ['/', '/signup'];
      const isPublicPage = publicPages.includes(pathname);

      if (!supabaseUser) {
        setUser(null);
        if (!isPublicPage) {
          router.push('/');
        }
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', supabaseUser.id)
        .single();
      
      if (error || !profile) {
        console.error("Error fetching profile or profile not found:", error?.message);
        await supabase.auth.signOut(); // Force sign out if profile is missing
        setUser(null);
        if (!isPublicPage) {
          router.push('/');
        }
      } else {
        const userData: User = {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: profile.name,
          role: profile.role as UserRole,
        };
        setUser(userData);
        if (isPublicPage) {
            router.push('/dashboard');
        }
      }
      setLoading(false);
    };

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
        handleAuthChange('INITIAL_SESSION', session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      authListener.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // onAuthStateChange will handle success and loading state will be updated there
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
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: "Não foi possível criar o usuário." });
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
            // Best effort to clean up user. This might require admin privileges.
            // For now, just sign out.
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
    // onAuthStateChange will handle setting user to null and redirection
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
