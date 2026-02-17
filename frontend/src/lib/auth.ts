/**
 * Auth service for handling authentication with backend API
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

// Store access token in memory (not localStorage for security)
let accessToken: string | null = null;

// Track if a refresh is in progress to prevent race conditions
let refreshPromise: Promise<string | null> | null = null;

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Business {
  id: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  business: Business;
  accessToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  businessName: string;
}

export const authService = {
  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return accessToken;
  },

  /**
   * Set access token (used after login/refresh)
   */
  setAccessToken(token: string | null): void {
    accessToken = token;
  },

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Important for cookies
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Login gagal");
    }

    const result = await response.json();
    const data = result.data as AuthResponse;
    
    // Store access token in memory
    accessToken = data.accessToken;
    
    return data;
  },

  /**
   * Register new user with business
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || "Registrasi gagal");
    }

    const result = await response.json();
    const authData = result.data as AuthResponse;
    
    // Store access token in memory
    accessToken = authData.accessToken;
    
    return authData;
  },

  /**
   * Refresh access token using HttpOnly cookie.
   * Uses deduplication to prevent multiple concurrent refresh calls.
   * Does NOT clear a valid accessToken on failure — only clears if there was no token before.
   */
  async refreshToken(): Promise<string | null> {
    // If a refresh is already in progress, reuse the same promise
    if (refreshPromise) {
      return refreshPromise;
    }

    const hadTokenBefore = !!accessToken;

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include", // Send cookies
        });

        if (!response.ok) {
          // Only clear token if we didn't have one before the refresh attempt
          // This prevents wiping a valid login token during background checks
          if (!hadTokenBefore) {
            accessToken = null;
          }
          return null;
        }

        const result = await response.json();
        if (result.data?.accessToken) {
          accessToken = result.data.accessToken;
          return accessToken;
        }

        return null;
      } catch {
        if (!hadTokenBefore) {
          accessToken = null;
        }
        return null;
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  },

  /**
   * Logout - clear token and cookie
   */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore errors on logout
    }
    
    accessToken = null;
  },

  /**
   * Get current user info
   */
  async getMe(): Promise<{ user: User; business: Business } | null> {
    if (!accessToken) {
      // Try to refresh token first
      const token = await this.refreshToken();
      if (!token) return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try refresh
          const newToken = await this.refreshToken();
          if (newToken) {
            // Retry with new token
            const retryResponse = await fetch(`${API_BASE_URL}/auth/me`, {
              headers: {
                Authorization: `Bearer ${newToken}`,
              },
              credentials: "include",
            });
            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              return retryResult.data;
            }
          }
        }
        return null;
      }

      const result = await response.json();
      return result.data;
    } catch {
      return null;
    }
  },

  /**
   * Make authenticated API request
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    if (!headers.has("Content-Type") && options.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
      credentials: "include",
    });

    // If unauthorized, try to refresh and retry
    if (response.status === 401) {
      const newToken = await this.refreshToken();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        return fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers,
          credentials: "include",
        });
      }
    }

    return response;
  },
};
