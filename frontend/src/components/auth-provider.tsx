"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService, type User, type Business } from "@/lib/auth";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  business: Business | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, businessName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/", "/forgot-password", "/reset-password"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const isAuthenticated = !!user;

  // Check auth on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const result = await authService.getMe();
        if (result) {
          setUser(result.user);
          setBusiness(result.business);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Redirect logic
  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = PUBLIC_ROUTES.some((route) => 
      pathname === route || pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password")
    );

    if (!isAuthenticated && !isPublicRoute) {
      // Redirect to login if not authenticated and on protected route
      router.push("/login");
    } else if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
      // Redirect to dashboard if authenticated and on auth pages
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login({ email, password });
    setUser(result.user);
    setBusiness(result.business);
    router.push("/dashboard");
  }, [router]);

  const register = useCallback(async (email: string, password: string, businessName: string) => {
    const result = await authService.register({ email, password, businessName });
    setUser(result.user);
    setBusiness(result.business);
    router.push("/dashboard");
  }, [router]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setBusiness(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        business,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
