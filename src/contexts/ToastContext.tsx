'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '@/components/Toast';

interface ToastContextType {
  showToast: (message: React.ReactNode, type?: 'success' | 'error' | 'warning', duration?: number) => void;
  hideToast: () => void;
  message: React.ReactNode;
  isVisible: boolean;
  toastType: 'success' | 'error' | 'warning';
  duration: number | undefined;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<React.ReactNode>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');
  const [duration, setDuration] = useState<number | undefined>(undefined);

  const showToast = useCallback((newMessage: React.ReactNode, type: 'success' | 'error' | 'warning' = 'success', toastDuration?: number) => {
    setMessage(newMessage);
    setToastType(type);
    setDuration(toastDuration);
    setIsVisible(true);
  }, []);

  const hideToast = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, message, isVisible, toastType, duration }}>
      {children}
    </ToastContext.Provider>
  );
};
