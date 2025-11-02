'use client';

import React, { useState, useRef } from 'react';
import { AttachmentButton } from './AttachmentButton';
import { SendButton } from './SendButton';
import { InputSectionBackground } from './InputSectionBackground';
import { TypeInputBackground } from './TypeInputBackground';

interface MessageInputProps {
  onSendMessage?: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  placeholder = "type a button with text the residency",
  disabled = false,
}) => {
  const [messageText, setMessageText] = useState('');
  const divRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = () => {
    if (messageText.trim() && !disabled) {
      if (onSendMessage) {
        onSendMessage(messageText.trim());
      }
      
      setMessageText('');
      if (divRef.current) {
        divRef.current.innerText = '';
      }
    }
  };

  const handleAttachmentPress = () => {
  };

  const handleDivInput = (event: React.FormEvent<HTMLDivElement>) => {
    const text = event.currentTarget.innerText || '';
    setMessageText(text);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="relative h-[103px] w-full px-2">
      {/* SVG Background */}
      <div className="absolute inset-0 w-full">
        <InputSectionBackground height={103} />
      </div>
      
      {/* Content positioned over SVG */}
      <div className="absolute top-8 left-5 right-5 bottom-4 flex items-center gap-3">
        <button 
          className="w-8 h-8 flex items-center justify-center disabled:opacity-50"
          onClick={handleAttachmentPress}
          disabled={disabled}
          aria-label="Attach file"
        >
          <AttachmentButton size={32} />
        </button>
        
        <div className="flex-1 relative rounded-[20px] px-4 py-2 flex items-center h-9">
          {/* SVG Background for input */}
          <div className="absolute inset-0 w-full">
            <TypeInputBackground height={36} />
          </div>
          
          {/* Placeholder */}
          {!messageText && (
            <div
              className="absolute top-0 left-4 right-4 bottom-0 z-0 text-base pointer-events-none leading-9 h-9"
              style={{ color: '#999999' }}
            >
              {placeholder}
            </div>
          )}
          
          {/* Text Input */}
          <div
            ref={divRef}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className={`absolute top-0 left-4 right-4 bottom-0 z-10 text-base outline-none border-none bg-transparent p-0 m-0 overflow-hidden whitespace-nowrap text-ellipsis leading-9 h-9 ${
              disabled ? 'text-gray-600 pointer-events-none' : 'text-white'
            }`}
            onInput={handleDivInput}
            onKeyDown={handleKeyDown}
          />
        </div>
        
        <button 
          className="w-8 h-8 rounded-2xl flex items-center justify-center disabled:opacity-50"
          onClick={handleSendMessage}
          disabled={disabled}
          aria-label="Send message"
        >
          <SendButton size={20} />
        </button>
      </div>
    </div>
  );
};
