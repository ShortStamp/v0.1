"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { BeautyProfile } from "@/types";

interface User {
  id: string;
  email: string;
  display_name: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  loginWithApple: (idToken: string, user?: object) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  loginWithApple: async () => {},
  logout: async () => {},
});

async function syncProfileAfterAuth() {
  try {
    const raw = localStorage.getItem("beautyProfile");
    if (raw) {
      const profile: BeautyProfile = JSON.parse(raw);
      await api.saveProfile(profile);
    }
  } catch {
    // Silently ignore sync errors
  }
}

async function loadProfileFromBackend() {
  try {
    const profile = await api.getProfile();
    if (profile && (profile.skinTone || profile.undertone || profile.skinType)) {
      localStorage.setItem("beautyProfile", JSON.stringify(profile));
    }
  } catch {
    // Profile may not exist yet
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (api.isAuthenticated) {
        try {
          const u = await api.getMe();
          setUser(u);
          await loadProfileFromBackend();
        } catch {
          api.clearTokens();
          setUser(null);
        }
      }
      setIsLoading(false); // Always set to false after initial check, regardless of auth status
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password);
    setUser(data.user);
    await syncProfileAfterAuth();
  }, []);

  const signup = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const data = await api.signup(email, password, displayName);
      setUser(data.user);
      await syncProfileAfterAuth();
    },
    []
  );

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await api.oauthGoogle(idToken);
    setUser(data.user);
    await syncProfileAfterAuth();
  }, []);

  const loginWithApple = useCallback(async (idToken: string, appleUser?: object) => {
    const data = await api.oauthApple(idToken, appleUser);
    setUser(data.user);
    await syncProfileAfterAuth();
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        loginWithGoogle,
        loginWithApple,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
