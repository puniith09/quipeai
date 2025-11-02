'use client';

import { SearchButton } from './SearchButton';
import { useToast } from '@/contexts/ToastContext';
import { Toast } from '@/components/Toast';

interface ChatHeaderProps {
  onSearchClick?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onSearchClick }) => {
  const { showToast, message, isVisible, toastType, duration, hideToast } = useToast();
  
  const handleSearchClick = () => {
    showToast(
      <>
        <span style={{ fontWeight: 700 }}>Under construction!</span> Search feature coming soon.
      </>,
      'warning'
    );
    
    if (onSearchClick) {
      onSearchClick();
    }
  };
  
  return (
    <div className="relative px-5 py-2 bg-[#313131] rounded-t-[24px] cursor-grab active:cursor-grabbing overflow-hidden">
      <Toast
        message={message}
        type={toastType}
        isVisible={isVisible}
        duration={duration}
        onHide={hideToast}
      />
      
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-gray-600 rounded-full z-10" />
      
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-white text-lg font-bold">Chat</h1>
        <div className="flex gap-3">
          <button 
            onClick={handleSearchClick}
            className="p-2 hover:opacity-70 transition-opacity"
            aria-label="Search"
          >
            <SearchButton size={20} color="white" />
          </button>
        </div>
      </div>
    </div>
  );
};
