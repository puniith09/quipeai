'use client';

import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: React.ReactNode;
  isVisible: boolean;
  onHide: () => void;
  duration?: number;
  type?: 'success' | 'error' | 'warning';
}

const TOAST_DURATION = 1500;

const TOAST_TYPES = {
  success: {
    backgroundColor: '#00D09C',
    textColor: '#ffffff'
  },
  error: {
    backgroundColor: '#FF5C5C',
    textColor: '#ffffff'
  },
  warning: {
    backgroundColor: '#FFB800',
    textColor: '#ffffff'
  }
};

export const Toast: React.FC<ToastProps> = ({
  message,
  isVisible,
  onHide,
  duration = TOAST_DURATION,
  type = 'success',
}) => {
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (isVisible) {
      setAnimationClass('toast-slide-in');

      if (duration > 0) {
        const timer = setTimeout(() => {
          hideToast();
        }, duration);

        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, duration]);

  const hideToast = () => {
    setAnimationClass('toast-slide-out');
    setTimeout(() => {
      onHide();
    }, 300);
  };

  if (!isVisible && !animationClass) return null;

  return (
    <div 
      className={`toast-inline ${animationClass}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        width: '100%',
        backgroundColor: TOAST_TYPES[type].backgroundColor,
        borderRadius: '0 0 0 0',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      <div 
        className="toast-content"
        style={{
          paddingTop: '8px',
          paddingBottom: '8px',
          paddingLeft: '20px',
          paddingRight: '20px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          className="toast-text"
          style={{
            color: TOAST_TYPES[type].textColor,
            fontSize: '14px',
            fontWeight: 500,
            textAlign: 'center',
          }}
        >
          {message}
        </div>
      </div>

      <style jsx>{`
        .toast-inline {
          transform: translateY(-100%);
          opacity: 0;
          transition: transform 0.3s ease-out, opacity 0.3s ease-out;
        }

        .toast-slide-in {
          transform: translateY(0);
          opacity: 1;
        }

        .toast-slide-out {
          transform: translateY(-100%);
          opacity: 0;
        }
      `}</style>
    </div>
  );
};
