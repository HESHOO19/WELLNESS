/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AccountType = "supplier" | "buyer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountType: AccountType;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  accountType: null,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>(null);

  const fetchAccountType = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", userId)
      .single();
    setAccountType((data?.account_type as AccountType) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    // Get initial session first, then subscribe to changes.
    // This prevents a race where onAuthStateChange fires before getSession resolves,
    // causing accountType to flicker as null for already-logged-in users.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAccountType(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAccountType(session.user.id);
      } else {
        setAccountType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccountType(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, accountType, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
