import React, { useState, useEffect } from 'react';
import { User, UserX, PhoneOff } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from './ui/Dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip';

const ResultAvatar = ({ result, size = 32 }) => {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [result?.avatar]);

  if (result?.avatar && !broken) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            className="rounded-full overflow-hidden bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary hover:opacity-80 transition-opacity shrink-0"
            style={{ width: size, height: size }}
            title="View profile picture"
          >
            <img
              src={result.avatar}
              alt="Profile picture"
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setBroken(true)}
            />
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm flex items-center justify-center bg-transparent border-none shadow-none">
          <img src={result.avatar} alt="Full profile picture" className="w-full h-auto rounded-xl shadow-2xl max-w-[300px]" />
        </DialogContent>
      </Dialog>
    );
  }

  if (result?.exists) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="rounded-full bg-background border border-dashed border-border flex items-center justify-center text-text-muted cursor-default shrink-0"
            style={{ width: size, height: size }}
          >
            <User size={size / 2.4} />
          </button>
        </TooltipTrigger>
        <TooltipContent>No Profile Photo</TooltipContent>
      </Tooltip>
    );
  }

  if (result?.isValidFormat) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="rounded-full bg-error/10 border border-error/30 flex items-center justify-center text-error cursor-default shrink-0"
            style={{ width: size, height: size }}
          >
            <UserX size={size / 2.4} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Not Registered on WhatsApp</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center text-warning cursor-default shrink-0"
          style={{ width: size, height: size }}
        >
          <PhoneOff size={size / 2.4} />
        </button>
      </TooltipTrigger>
      <TooltipContent>Invalid Number</TooltipContent>
    </Tooltip>
  );
};

export default ResultAvatar;
