/* eslint-disable react-refresh/only-export-components -- auth helpers and the provider belong together */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type FirmRole = "ADMIN" | "ACCOUNTANT" | null; // null = user at a client company
export type User = {
  id: string;
  email: string;
  fullName: string;
  firmRole: FirmRole;
};

// The access token lives only in memory (not in localStorage), the refresh token is an httpOnly cookie
let accessToken: string | null = null;
let onSessionExpired: () => void = () => {};
let refreshing: Promise<User | null> | null = null;

// One shared refresh at a time – two parallel refreshes would invalidate each other (token rotation)
function refreshSession(): Promise<User | null> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then(async (res) => {
      if (!res.ok) return null;
      const body = await res.json();
      accessToken = body.accessToken;
      return body.user as User;
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// fetch with the access token; on 401 it refreshes the token once and repeats the request
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(url, { ...init, headers });
  };

  const res = await send();
  if (res.status !== 401) return res;

  const user = await refreshSession();
  if (!user) {
    accessToken = null;
    onSessionExpired();
    return res;
  }
  return send();
}

// Where each role lands after login
export function homePath(user: User) {
  return user.firmRole === "ADMIN" ? "/clients" : "/welcome";
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On page load: try to restore the session from the refresh cookie
  useEffect(() => {
    onSessionExpired = () => setUser(null);
    refreshSession().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Prijava ni uspela");
    accessToken = body.accessToken;
    setUser(body.user);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    accessToken = null;
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
