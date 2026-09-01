import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow = '';

const lockBody = () => {
  lockCount += 1;
  if (lockCount === 1) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
};

const unlockBody = () => {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
    originalOverflow = '';
  }
};

// Locks body scroll while the overlay/modal is mounted. Nested overlays share a
// single document-level counter so opening a viewer inside a dialog never
// unlocks the body prematurely.
export const useBodyScrollLock = (active) => {
  useEffect(() => {
    if (!active) return;
    lockBody();
    return unlockBody;
  }, [active]);
};