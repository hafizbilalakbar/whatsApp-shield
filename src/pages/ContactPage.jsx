import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Clock, HelpCircle, Send, CheckCircle2, Github, Twitter, Linkedin, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12 relative overflow-hidden">
      {/* Floating circles background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full border border-primary/10 animate-float" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full border border-primary/5 animate-float-delayed" />
        <div className="absolute -bottom-40 left-1/4 w-80 h-80 rounded-full border border-secondary/10 animate-float-slow" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: Info */}
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Get in Touch</h1>
            <p className="text-text-secondary text-lg mb-10 max-w-md">
              Have a question, found a bug, or want to suggest a feature? We are here to help.
            </p>

            <div className="space-y-4 mb-10">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Email</h4>
                  <p className="text-sm text-text-secondary mt-0.5">
                    <a href="mailto:support@whatsappshield.local" className="text-primary hover:underline">support@whatsappshield.local</a>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Response Time</h4>
                  <p className="text-sm text-text-secondary mt-0.5">Within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <HelpCircle size={20} className="text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Support Type</h4>
                  <p className="text-sm text-text-secondary mt-0.5">Technical &amp; General Inquiries</p>
                </div>
              </div>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-4">
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/50 transition-all">
                <Github size={18} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/50 transition-all">
                <Twitter size={18} />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/50 transition-all">
                <Linkedin size={18} />
              </a>
              <a href="https://t.me" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-text-secondary hover:text-primary hover:border-primary/50 transition-all">
                <MessageCircle size={18} />
              </a>
            </div>
          </div>

          {/* Right: Form */}
          <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 shadow-sm">
            {sent ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-6">
                  <CheckCircle2 size={36} className="text-success" />
                </div>
                <h3 className="text-2xl font-display font-semibold mb-2">Message Sent Successfully</h3>
                <p className="text-text-secondary text-sm mb-8">We will get back to you within 24 hours.</p>
                <button onClick={() => setSent(false)} className="text-primary hover:underline text-sm font-medium">Send Another</button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Name</label>
                  <Input placeholder="Your full name" required className="bg-background" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <Input type="email" placeholder="you@example.com" required className="bg-background" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Subject</label>
                  <select className="w-full rounded-lg border border-border bg-background p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" required>
                    <option value="">Select a subject</option>
                    <option value="technical">Technical Issue</option>
                    <option value="feature">Feature Request</option>
                    <option value="general">General Inquiry</option>
                    <option value="partnership">Partnership</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Message</label>
                  <textarea
                    rows={5}
                    className="w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Describe your question or feedback..."
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-12">
                  <Send size={16} className="mr-2" /> Send Message
                </Button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
