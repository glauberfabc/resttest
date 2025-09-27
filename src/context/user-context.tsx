
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
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
  signup: (credentials: SignUpWithPasswordCredentials & { name: string }) => Promise<void>;
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
                if(window.location.pathname === '/' || window.location.pathname === '/signup') {
                  router.push('/dashboard/analytics');
                }
            } else {
                 console.error("Login successful but no profile found for user:", currentUser.id);
                 // This case might happen transiently during signup, before the profile is created.
                 if (event !== 'USER_UPDATED') {
                    toast({
                        variant: 'destructive',
                        title: 'Perfil não encontrado',
                        description: 'Seu usuário existe, mas não há um perfil associado. Contate o suporte.'
                    });
                    await supabase.auth.signOut();
                    setUser(null);
                 }
            }
        } else {
            setUser(null);
            if (window.location.pathname !== '/' && window.location.pathname !== '/signup') {
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

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    const { name, email, password } = credentials;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError.message);
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: signUpError.message });
      return;
    }

    if (signUpData.user) {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({ id: signUpData.user.id, name, email, role: 'collaborator' });
        
        if (profileError) {
            console.error('Error creating profile:', profileError.message);
            toast({
                variant: 'destructive',
                title: 'Erro ao criar perfil',
                description: 'Sua conta foi criada, mas houve um erro ao configurar seu perfil. Por favor, contate o suporte.'
            });
            // Optional: delete the user if profile creation fails
            // await supabase.auth.admin.deleteUser(signUpData.user.id);
            await supabase.auth.signOut();
        }
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
