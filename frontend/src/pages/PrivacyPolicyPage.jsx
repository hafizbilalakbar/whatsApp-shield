import React from 'react';
import { Shield, Lock, Database, Mail, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="text-primary h-8 w-8" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Privacy Policy</h1>
        </div>
        <p className="text-text-secondary">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database size={18} className="text-primary" /> Data Collection</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>WhatsApp Shield operates entirely on your local machine. We do not collect, transmit, or store any personal data on external servers.</p>
            <p>The only data stored locally on your device includes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>WhatsApp session authentication keys (stored in a local directory)</li>
              <li>Validation campaign history and results (stored in local JSON files)</li>
              <li>Theme preference (stored in browser localStorage)</li>
            </ul>
            <p className="font-semibold text-text-primary">WhatsApp Shield does not store phone numbers or chat content. All validation is sandboxed and session-local.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity size={18} className="text-primary" /> Data Usage</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>Any phone numbers you submit for validation are processed in real-time through your local WhatsApp Web connection. These numbers are:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Never uploaded to any remote server</li>
              <li>Never stored beyond your local campaign history files</li>
              <li>Never shared with third parties</li>
            </ul>
            <p>You retain full ownership and control over your audience data at all times.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock size={18} className="text-primary" /> Data Storage & Retention</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>Campaign history is stored locally in <code className="text-primary font-mono text-xs bg-surface px-1.5 py-0.5 rounded border border-border">campaign_history.json</code> and session history in <code className="text-primary font-mono text-xs bg-surface px-1.5 py-0.5 rounded border border-border">session_history.json</code>.</p>
            <p>You can delete these files at any time to permanently remove all stored data. No residual copies exist on any remote infrastructure.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database size={18} className="text-primary" /> Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>WhatsApp Shield communicates with WhatsApp Web servers through the <code className="text-primary font-mono text-xs bg-surface px-1.5 py-0.5 rounded border border-border">@whiskeysockets/baileys</code> library to perform number validation. This is the same communication that occurs when using WhatsApp Web in a browser.</p>
            <p>No third-party analytics, tracking, or advertising services are used.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail size={18} className="text-primary" /> Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed">
            <p>If you have questions about this privacy policy, please open an issue on the project repository.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
