'use client';

import { QuipeTextLogo } from './QuipeTextLogo';
import { SettingsButton } from './SettingsButton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  
  const handleSettingsClick = async () => {
    if (isAuthenticated) {
      await logout();
      showToast(
        <>
          <span style={{ fontWeight: 700 }}>Signed out!</span> You have been logged out successfully.
        </>,
        'success'
      );
    } else if (onSettingsClick) {
      onSettingsClick();
    }
  };
  
  return (
    <header 
      className="flex items-center justify-between px-5 pt-2 pb-0 bg-white flex-shrink-0" 
      style={{ 
        touchAction: 'none', 
        paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' 
      }}
    >
      <div className="flex items-center gap-3">
        <QuipeTextLogo size={26} />
        {isAuthenticated && user && (
          <span className="text-xs text-gray-600 hidden sm:inline">
            {user.phoneNumber}
          </span>
        )}
      </div>
      <button 
        onClick={handleSettingsClick}
        className="p-2 hover:opacity-70 transition-opacity"
        aria-label={isAuthenticated ? "Sign out" : "Settings"}
        title={isAuthenticated ? "Tap to sign out" : "Settings"}
      >
        <SettingsButton size={20} />
      </button>
    </header>
  );
};
