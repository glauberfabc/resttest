
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';

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
                console.error("Error fetching profile:", error);
                // Handle error, maybe logout user
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
  }, [router]);

  const login = async (credentials: { email: string; password?: string }) => {
    const { email, password } = credentials;
    if (!password) {
        console.error("Login failed: Password is required");
        return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("Login failed:", error.message);
        // Optionally, you can show a toast notification here
    } 
    // The onAuthStateChange listener will handle setting the user and redirecting
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/');
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
