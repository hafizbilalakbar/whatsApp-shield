import React from 'react';
import { Shield, Database, Lock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function DataProcessingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-primary h-8 w-8" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Data Processing Agreement</h1>
        </div>
        <p className="text-text-secondary">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database size={18} className="text-primary" /> What We Process</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>WhatsApp Shield processes the following data solely for the purpose of number validation:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Phone numbers</strong> — submitted by you for WhatsApp registration verification</li>
              <li><strong>WhatsApp profile data</strong> — publicly available profile pictures and status text of validated numbers</li>
              <li><strong>Session credentials</strong> — temporary authentication keys for your WhatsApp Web connection</li>
            </ul>
            <p>All processing occurs locally on your machine. No data is transmitted to external servers.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield size={18} className="text-primary" /> Legal Basis for Processing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed">
            <p>Data is processed based on your explicit consent and legitimate interest in verifying WhatsApp registration status of phone numbers you own or have permission to contact. You retain full control over the data at all times.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock size={18} className="text-primary" /> Data Retention</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>Data retention is entirely user-controlled:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Validation results are stored in local JSON files until you delete them</li>
              <li>Session authentication keys are stored locally and can be cleared via the "Disconnect" button</li>
              <li>No automated data retention periods are enforced — you are in full control</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye size={18} className="text-primary" /> Your Rights</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>As the data controller, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access</strong> — View all stored data by reading local JSON files</li>
              <li><strong>Rectification</strong> — Correct any data by editing local files</li>
              <li><strong>Erasure</strong> — Delete all data by removing local files or disconnecting the session</li>
              <li><strong>Portability</strong> — Export data in CSV, JSON, TXT, or PDF format</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
