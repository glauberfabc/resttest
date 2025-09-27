
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
            // Don't sign out here, as it might be a transient network error
            // or the user is signing up.
            setUser(null);
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
        if (currentUser) {
          // On SIGNED_IN, the profile might not be created yet if it's a new signup.
          // The signup function will handle setting the user.
          // For other events like TOKEN_REFRESHED, we fetch the user.
          if (event !== 'SIGNED_IN') {
             fetchUser(currentUser);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login failed:", error.message);
        toast({ variant: 'destructive', title: "Erro no Login", description: error.message });
    } else if (data.user) {
        // After successful sign-in, manually trigger profile fetching.
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('name, role')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error("Error fetching profile after login:", profileError.message);
            toast({ variant: 'destructive', title: "Erro ao buscar perfil", description: profileError.message });
            await supabase.auth.signOut();
        } else {
             const userData: User = {
                id: data.user.id,
                email: data.user.email!,
                name: profile.name,
                role: profile.role as UserRole,
            };
            setUser(userData);
            router.push('/dashboard/analytics');
        }
    }
  };

  const signup = async (credentials: SignUpWithPasswordCredentials & { name: string }) => {
    const { name, email, password } = credentials;

    // 1. Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      console.error('Signup failed:', signUpError.message);
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: signUpError.message });
      return;
    }

    if (!signUpData.user) {
      toast({ variant: 'destructive', title: 'Erro no Cadastro', description: 'Não foi possível criar o usuário.' });
      return;
    }

    // 2. Create the profile for the new user
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
      // Clean up the created user if profile creation fails
      await supabase.auth.signOut();
      // You might want to delete the user here if you have admin rights configured
      return;
    }

    // 3. Manually set the user in the context to avoid race conditions
    const newUser: User = {
      id: signUpData.user.id,
      email: signUpData.user.email!,
      name: name,
      role: 'collaborator',
    };
    setUser(newUser);
    router.push('/dashboard/analytics');
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
