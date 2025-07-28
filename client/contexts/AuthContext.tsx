import React, { createContext, useContext, useState, useEffect } from "react";
import { User, LoginRequest, LoginResponse } from "@shared/auth";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  useEffect(() => {
    // Check for stored auth data on mount
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);

        // Validate token with server (async, don't await)
        validateToken(storedToken).catch(() => {
          // If validation fails, user will be logged out
          console.log("Token validation failed, user logged out");
        });
      } catch (error) {
        console.error("Error parsing stored user data:", error);
        logout();
      }
    }

    setIsLoading(false);
  }, []);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch("/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn(`Token validation failed with status: ${response.status}`);
        logout();
        return;
      }

      const data = await response.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        console.warn("Invalid token response format:", data);
        logout();
      }
    } catch (error) {
      console.error("Token validation network error:", error);
      // Don't logout on network errors, keep the stored user
      // Only logout if it's a 401/403 response
    }
  };

  const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.user && data.token) {
        setUser(data.user);
        setToken(data.token);

        // Store in localStorage
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
      }

      return data;
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        message: "Network error occurred",
      };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");

    // Call logout endpoint
    fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    }).catch(console.error);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isLoading,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Helper function to make authenticated API calls
export async function makeAuthenticatedRequest(
  url: string,
  options: RequestInit = {},
) {
  const token = localStorage.getItem("auth_token");

  if (!token) {
    throw new Error("No authentication token found");
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid, logout user
    const authEvent = new CustomEvent("auth:logout");
    window.dispatchEvent(authEvent);
    throw new Error("Authentication expired");
  }

  return response;
}
