'use client';

import React, { useState } from 'react';
import { logger } from '@/lib/logger';

interface TextInputProps {
  placeholder?: string;
  label?: string;
  defaultValue?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  backgroundColor?: string;
  textColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  borderColor?: string;
  padding?: string;
  fontSize?: string;
  width?: string;
  height?: string;
  labelColor?: string;
  labelSize?: string;
  labelWeight?: string;
  action?: string;
  submitLabel?: string; // Label for submit button
  submitMessage?: string; // Message to send when button is clicked (instead of input value)
  onChange?: (value: string) => void;
  onSubmit?: (value: string, submitMessage?: string) => void; // Callback when submitted
  children?: React.ReactNode;
}

export const TextInput: React.FC<TextInputProps> = ({
  placeholder = 'Enter text...',
  label,
  defaultValue = '',
  type = 'text',
  disabled = false,
  required = false,
  maxLength,
  backgroundColor,
  textColor,
  borderRadius,
  borderWidth,
  borderColor,
  padding,
  fontSize,
  width,
  height,
  labelColor,
  labelSize,
  labelWeight,
  action,
  submitLabel = 'Submit',
  submitMessage, // NEW: Message to send when button clicked
  onChange,
  onSubmit,
  children,
}) => {
  const [value, setValue] = useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (onChange) {
      onChange(newValue);
    }
    
    if (action) {
      logger.log('TextInput change:', { action, value: newValue });
    }
  };

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    logger.log('TextInput submit:', { action, value, submitMessage });
    
    if (onSubmit) {
      // If submitMessage is provided, use it instead of the input value
      await onSubmit(value, submitMessage);
    }
    
    setIsSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const inputStyles: React.CSSProperties = {
    ...(backgroundColor && { backgroundColor }),
    ...(textColor && { color: textColor }),
    ...(borderRadius && { borderRadius }),
    ...(borderWidth && { borderWidth }),
    ...(borderColor && { borderColor }),
    ...(padding && { padding }),
    ...(fontSize && { fontSize }),
    ...(width && { width }),
    ...(height && { height }),
  };

  const labelStyles: React.CSSProperties = {
    ...(labelColor && { color: labelColor }),
    ...(labelSize && { fontSize: labelSize }),
    ...(labelWeight && { fontWeight: labelWeight }),
  };

  return (
    <div className="w-full max-w-full">
      {label && (
        <label 
          className="block mb-2 text-sm font-medium text-gray-200"
          style={labelStyles}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        required={required}
        maxLength={maxLength}
        className="w-full px-4 py-2 border border-gray-600 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-700 disabled:cursor-not-allowed transition-all placeholder:text-gray-400"
        style={inputStyles}
      />
      {children}
    </div>
  );
};
