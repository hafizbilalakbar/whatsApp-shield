import React from 'react';

const WhatsAppShieldLogo = ({ size = 32, className = '' }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Shield */}
      <path 
        d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Inner Communication Motif (Message Bubble / Check) */}
      <path 
        d="M8.5 11.5L11 14L15.5 9" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default WhatsAppShieldLogo;
