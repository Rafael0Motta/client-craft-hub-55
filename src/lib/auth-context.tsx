import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor" | "cliente";

interface Profile {
  id: string;
  nome: string;
  email: string;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  clienteId: string | null; // só para role=cliente
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (uid: string) => {
    const [{ data: prof }, { data: roleRow }, { data: clienteRow }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).order("role").limit(1).maybeSingle(),
      supabase.from("clientes").select("id").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(prof as Profile | null);
    setRole((roleRow?.role as AppRole) ?? null);
    setClienteId(clienteRow?.id ?? null);
  };

  useEffect(() => {
    let loadedForUserId: string | null = null;

    const maybeLoad = (uid: string | null) => {
      if (!uid) {
        loadedForUserId = null;
        setProfile(null);
        setRole(null);
        setClienteId(null);
        setLoading(false);
        return;
      }
      if (loadedForUserId === uid) {
        // mesmo usuário — não recarregar (evita refetch em TOKEN_REFRESHED, foco etc.)
        setLoading(false);
        return;
      }
      loadedForUserId = uid;
      setTimeout(() => {
        loadUserData(uid).finally(() => setLoading(false));
      }, 0);
    };

    // 1) Listener PRIMEIRO
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      maybeLoad(newSession?.user?.id ?? null);
    });

    // 2) getSession depois
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      maybeLoad(s?.user?.id ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refresh = async () => {
    if (user) await loadUserData(user.id);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, clienteId, loading, signIn, signOut, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
