'use client';

import { QuipeTextLogo } from './QuipeTextLogo';
import { SettingsButton } from './SettingsButton';

interface HeaderProps {
  onSettingsClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  return (
    <header 
      className="flex items-center justify-between px-5 pt-2 pb-0 bg-white flex-shrink-0" 
      style={{ 
        touchAction: 'none', 
        paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)' 
      }}
    >
      <QuipeTextLogo size={26} />
      <button 
        onClick={onSettingsClick}
        className="p-2 hover:opacity-70 transition-opacity"
        aria-label="Settings"
      >
        <SettingsButton size={20} />
      </button>
    </header>
  );
};
