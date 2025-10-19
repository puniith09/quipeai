import { memo } from 'react';

interface AttachmentButtonProps {
  size?: number;
  className?: string;
}

const AttachmentButtonComponent: React.FC<AttachmentButtonProps> = ({ 
  size = 32,
  className 
}) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 28 28" 
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id="attachment-gradient" x1="14" y1="0" x2="14" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#007AFF" offset="0" />
          <stop stopColor="#5CE2FF" offset="1" />
        </linearGradient>
      </defs>
      
      <circle 
        cx="14" 
        cy="14" 
        r="14" 
        fill="url(#attachment-gradient)"
      />
      
      <path 
        d="M8.83 15.076H13.414V19.659C13.414 20.117 13.786 20.489 14.244 20.489C14.703 20.489 15.075 20.117 15.075 19.659V15.076L19.658 15.076C20.117 15.076 20.489 14.704 20.489 14.245C20.489 13.787 20.117 13.415 19.658 13.415H15.075V8.832C15.075 8.374 14.703 8.002 14.244 8.002C13.786 8.002 13.414 8.374 13.414 8.832V13.415H8.83C8.372 13.415 8 13.787 8 14.245C8 14.704 8.372 15.076 8.83 15.076Z"
        fill="white"
      />
    </svg>
  );
};

AttachmentButtonComponent.displayName = 'AttachmentButton';

export const AttachmentButton = memo(AttachmentButtonComponent);
