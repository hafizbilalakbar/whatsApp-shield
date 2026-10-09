import React, { useState } from 'react';
import { LogOut } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from './AlertDialog';

/**
 * Confirmation dialog for ending the WhatsApp session.
 *
 * Compliance data (opt-out log, suppression list, blocked contacts, transfer
 * rules) is NEVER deleted by default. The user must explicitly tick the opt-in
 * checkbox below; logout works without it.
 */
export const LogoutConfirmDialog = ({ open, onOpenChange, logout }) => {
  const [deleteComplianceData, setDeleteComplianceData] = useState(false);

  const confirm = () => {
    const flag = deleteComplianceData;
    setDeleteComplianceData(false);
    onOpenChange?.(false);
    logout?.({ deleteComplianceData: flag });
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) setDeleteComplianceData(false); onOpenChange?.(v); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LogOut size={18} className="text-error" /> Disconnect this session?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This unlinks the WhatsApp device and clears the local session, gateway logs,
            cached avatars, and scan state. You will need to scan the QR code again to reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <label className="mt-1 flex items-start gap-3 rounded-lg border border-border/70 bg-background/50 p-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={deleteComplianceData}
            onChange={(e) => setDeleteComplianceData(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-error shrink-0"
          />
          <span className="text-sm">
            <span className="block font-medium text-text-primary">Also delete opt-out and blocklist data</span>
            <span className="block text-xs text-text-muted">
              Permanently removes the opt-out log, suppression list, blocked contacts, and
              transfer rules. Off by default — these are compliance records.
            </span>
          </span>
        </label>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} className="bg-error hover:bg-error/90 text-white">
            Disconnect
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
