/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AccountType = "supplier" | "buyer" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountType: AccountType;
  refreshAccountType: (userId?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  accountType: null,
  refreshAccountType: async () => {},
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>(null);

  const refreshAccountType = useCallback(async (userId?: string) => {
    const lookupId = userId ?? user?.id;
    if (!lookupId) {
      setAccountType(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", lookupId)
      .single();

    if (data?.account_type) {
      setAccountType(data.account_type as AccountType);
      setLoading(false);
      return;
    }

    if (error && error.code && error.code !== "PGRST116") {
      setAccountType(null);
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user ?? user;
    const metaType = authUser?.user_metadata?.account_type;

    if (metaType === "buyer" || metaType === "supplier") {
      const payload: {
        id: string;
        account_type: "buyer" | "supplier";
        email?: string | null;
        business_name?: string;
        phone?: string;
      } = {
        id: lookupId,
        account_type: metaType,
        email: authUser?.email ?? null,
      };

      const businessName = authUser?.user_metadata?.business_name;
      if (typeof businessName === "string" && businessName.trim()) {
        payload.business_name = businessName.trim();
      }

      const phone = authUser?.user_metadata?.phone;
      if (typeof phone === "string" && phone.trim()) {
        payload.phone = phone.trim();
      }

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (!upsertError) {
        setAccountType(metaType);
        setLoading(false);
        return;
      }
    }

    setAccountType(null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    // Get initial session first, then subscribe to changes.
    // This prevents a race where onAuthStateChange fires before getSession resolves,
    // causing accountType to flicker as null for already-logged-in users.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshAccountType(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        refreshAccountType(session.user.id);
      } else {
        setAccountType(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshAccountType]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccountType(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, accountType, refreshAccountType, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
