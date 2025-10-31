'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  phoneNumber: string;
  sessionCount: number;
  lastLogin: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isReturningUser: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReturningUser, setIsReturningUser] = useState(false);

  // Load auth state from localStorage on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsReturningUser(true); // Flag that this is a returning user
        logger.info('Auth state restored from localStorage');
      }
    } catch (error) {
      logger.error('Error loading auth state:', error);
      // Clear corrupted data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((newToken: string, newUser: User) => {
    try {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('auth_token', newToken);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      logger.info('User logged in:', newUser.id);
    } catch (error) {
      logger.error('Error during login:', error);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      logger.info('User logged out');
    } catch (error) {
      logger.error('Error during logout:', error);
    }
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    try {
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      logger.info('User data updated');
    } catch (error) {
      logger.error('Error updating user:', error);
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    isReturningUser,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
