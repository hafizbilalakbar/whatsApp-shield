import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Shield, Sparkles, Bug, ArrowUp } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

const VERSIONS = [
  { version: '1.5.0', date: 'June 2026', badge: 'Latest', type: 'major', changes: [
    'Complete UI redesign with modern theme system',
    'Country detection engine with multi-country card display',
    'PDF export with country column and profile details',
    'Session restore with proper error handling',
    'User profile page with campaign timeline',
    'Number format guide page with live demo',
    'Animated user guide page',
    'About, Contact, Changelog, and FAQ pages',
    'Responsive design improvements for mobile',
    'Celebration animation on scan completion',
  ]},
  { version: '1.4.0', date: 'May 2026', badge: '', type: 'minor', changes: [
    'Campaign history with date and country filters',
    'Delete individual campaign entries',
    'History isolation per phone number',
    'Progress bar responsive fix for mobile',
    'Auto-format detection for phone numbers',
  ]},
  { version: '1.3.0', date: 'April 2026', badge: '', type: 'minor', changes: [
    'WhatsApp session restore functionality',
    'Previously paired devices listing',
    'Shield Mode with cooldown breaks',
    'Export to PDF with autoTable',
  ]},
  { version: '1.2.0', date: 'March 2026', badge: '', type: 'patch', changes: [
    'Campaign history page',
    'Audit log with detailed per-number results',
    'CSV, TXT, and JSON export formats',
    'Range generator for sequential numbers',
  ]},
  { version: '1.1.0', date: 'February 2026', badge: '', type: 'patch', changes: [
    'Live terminal with real-time logs',
    'Progress bar with percentage tracking',
    'Dark mode support',
  ]},
  { version: '1.0.0', date: 'January 2026', badge: '', type: 'major', changes: [
    'Initial release of WhatsApp Shield',
    'QR code authentication via Baileys',
    'Bulk number validation engine',
    'Basic dashboard with 5-step wizard',
    'REST API and WebSocket support',
  ]},
];

export default function ChangelogPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
        <Clock className="text-primary h-10 w-10 mx-auto mb-4" />
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-3">Changelog</h1>
        <p className="text-text-secondary">Version history and release notes for WhatsApp Shield.</p>
      </motion.div>

      <div className="relative">
        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />
        <div className="space-y-8">
          {VERSIONS.map((v, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="relative pl-12"
            >
              <div className={`absolute left-3 top-2 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-surface ${
                v.type === 'major' ? 'border-primary' : 'border-border'
              }`}>
                <div className={`w-2 h-2 rounded-full ${v.type === 'major' ? 'bg-primary' : 'bg-text-muted'}`} />
              </div>
              <div className="p-4 rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-3 mb-2">
                  <span className="font-bold text-lg font-display">v{v.version}</span>
                  <span className="text-xs text-text-muted">{v.date}</span>
                  {v.badge && <Badge variant="success">{v.badge}</Badge>}
                </div>
                <ul className="space-y-1">
                  {v.changes.map((change, j) => (
                    <li key={j} className="text-sm text-text-secondary flex items-start gap-2">
                      <span className="text-primary mt-1">·</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
