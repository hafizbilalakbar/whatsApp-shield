import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '../components/ui/cn';

const CATEGORIES = [
  { id: 'all', label: 'All Questions' },
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'formats', label: 'Number Formats' },
  { id: 'exports', label: 'Exports' },
  { id: 'sessions', label: 'Account & Sessions' },
];

const FAQS = [
  { q: 'Is my WhatsApp account safe with this tool?', a: 'Yes. WhatsApp Shield runs entirely on your local machine. Your session keys stay on your device and are never transmitted anywhere. Shield Mode adds randomized delays and automatic cooldown breaks to further reduce the risk of detection. However, no tool can guarantee 100% safety against WhatsApp\'s anti-spam systems.', category: 'security' },
  { q: 'Does WhatsApp Shield store my phone numbers?', a: 'Numbers are only stored locally in campaign history files on your machine. You can delete individual campaigns or clear all history at any time. No data is ever uploaded to any external server.', category: 'general' },
  { q: 'What is Shield Mode and how does it protect me?', a: 'Shield Mode implements humanized checking patterns: randomized jitter delays between each check (±50% of the base delay), automatic 5-second cooldown breaks every 10 checks, and irregular timing that mimics human behavior. This significantly reduces the chance of your account being flagged.', category: 'security' },
  { q: 'What number formats are supported?', a: 'Any globally common format works: +92 300 1234567, 0092-300-1234567, (300) 123-4567, 07911 123456 (UK), 8-800-123-45-67 (Russia), and many more. The tool automatically strips spaces, dashes, dots, and parentheses, then detects the country code. Visit the Number Format Guide for a full list of supported patterns.', category: 'formats' },
  { q: 'How do I export results to PDF?', a: 'After a validation campaign completes, go to Step 5 (Audit Reports & Export). Click the "Executive PDF Report" button to generate a formatted PDF with a summary header, pie chart statistics, and a detailed table of all results including phone numbers, country, status, and profile information.', category: 'exports' },
  { q: 'How do I restore a previous session?', a: 'Previously paired sessions appear in the "Previously Paired" section on the Dashboard. Click Restore next to any profile to reconnect instantly without scanning a QR code. The session credentials are preserved when you disconnect, enabling this fast reconnect feature.', category: 'sessions' },
  { q: 'What countries are supported?', a: 'WhatsApp Shield supports phone number validation across 195+ countries. The tool uses libphonenumber-js for parsing, which covers all ISO 3166-1 alpha-2 country codes. Visit the Number Format Guide to see supported regions including North America, Europe, Asia, Middle East, Africa, South America, and Oceania.', category: 'formats' },
  { q: 'Can I use this for bulk messaging?', a: 'WhatsApp Shield is designed for number validation only — it checks if phone numbers are registered on WhatsApp. Using this tool for unsolicited bulk messaging violates the terms of service. Always ensure compliance with local privacy regulations and WhatsApp\'s policies.', category: 'general' },
  { q: 'Why are some numbers showing as not registered?', a: 'A number may show as "Not Registered" if the phone number does not have an active WhatsApp account. Possible reasons: the number is a landline, the user has deleted WhatsApp, or the number has never been registered. The tool accurately reflects WhatsApp\'s real-time registry status.', category: 'exports' },
  { q: 'How accurate is the validation?', a: 'Validation accuracy depends on WhatsApp\'s current network status and the correctness of the phone number format. For properly formatted, real phone numbers, the tool provides highly accurate registration status. Invalid or improperly formatted numbers will be flagged in the results.', category: 'general' },
  { q: 'Is there a limit on how many numbers I can validate?', a: 'There is no hard limit built into the tool. However, for account safety we recommend keeping individual campaigns under 500 numbers and taking breaks between campaigns. Shield Mode is highly recommended for larger lists.', category: 'security' },
  { q: 'Can I export results to other formats?', a: 'Yes. You can export in four formats: CSV (full report with all fields), TXT (registered numbers only), JSON (complete raw data), and PDF (formatted executive report with summary and per-number details). Each export format is available from Step 5 of the dashboard.', category: 'exports' },
  { q: 'What happens to my session when I close the browser?', a: 'Your session credentials are preserved locally. When you return to the Dashboard, you can restore your session instantly without re-scanning the QR code. Sessions remain active until explicitly disconnected.', category: 'sessions' },
  { q: 'Does the tool work on mobile browsers?', a: 'WhatsApp Shield is optimized for desktop use. While the UI may render on mobile browsers, the tool is designed for desktop workflows with large data entry and export capabilities. We recommend using a laptop or desktop computer.', category: 'general' },
];

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openIndex, setOpenIndex] = useState(null);

  const filteredFAQs = useMemo(() => {
    let list = FAQS;
    if (activeCategory !== 'all') {
      list = list.filter(f => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
    }
    return list;
  }, [activeCategory, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <HelpCircle className="text-primary h-10 w-10 mx-auto mb-4" />
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Frequently Asked Questions</h1>
        <p className="text-text-secondary">Everything you need to know about WhatsApp Shield.</p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions..."
          className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
        />
      </motion.div>

      {/* Category tabs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeCategory === cat.id
                ? 'bg-primary text-white'
                : 'bg-surface border border-border text-text-secondary hover:text-primary hover:border-primary/50'
            )}
          >
            {cat.label}
          </button>
        ))}
      </motion.div>

      {/* FAQ List */}
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          {filteredFAQs.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-12 text-text-muted text-sm">
              No questions match your search.
            </motion.div>
          ) : (
            filteredFAQs.map((faq, i) => (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                layout
                className="rounded-xl border border-border bg-surface overflow-hidden faq-enter"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 md:p-5 text-left hover:bg-background/50 transition-colors"
                >
                  <span className="font-medium text-sm md:text-base pr-4">{faq.q}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-text-muted bg-background px-2 py-0.5 rounded">{faq.category}</span>
                    <ChevronDown size={18} className={cn("text-text-muted transition-transform duration-200 shrink-0", openIndex === i && "rotate-180")} />
                  </div>
                </button>
                {openIndex === i && (
                  <div className="px-4 md:px-5 pb-4 md:pb-5 text-sm text-text-secondary leading-relaxed border-t border-border pt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    {faq.a}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
