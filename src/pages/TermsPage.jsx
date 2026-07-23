import React from 'react';
import { FileText, AlertTriangle, Info, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="text-primary h-8 w-8" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Terms of Service</h1>
        </div>
        <p className="text-text-secondary">Last updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info size={18} className="text-primary" /> Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed">
            <p>By using WhatsApp Shield, you agree to these terms of service. If you do not agree, do not use this software.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield size={18} className="text-primary" /> Acceptable Use</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>You may use WhatsApp Shield to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Validate phone numbers for legitimate business or personal purposes</li>
              <li>Audit and clean your contact lists</li>
              <li>Verify WhatsApp registration status of numbers you have permission to contact</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Prohibited Uses</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg mb-3">
              <p className="font-semibold text-warning">This tool must not be used for spam. Users are responsible for compliance with WhatsApp Terms of Service.</p>
            </div>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Use this tool to harvest phone numbers for unsolicited messaging</li>
              <li>Violate WhatsApp's Terms of Service or applicable laws</li>
              <li>Use the tool to harass, abuse, or spam individuals</li>
              <li>Distribute validated number lists without proper consent</li>
              <li>Modify the software to remove safety delays or anti-ban protections</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info size={18} className="text-primary" /> Disclaimer</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed space-y-3">
            <p>WhatsApp Shield is provided "as is" without warranty of any kind. The authors make no guarantees about:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The accuracy of validation results</li>
              <li>Continuous availability of the WhatsApp Web interface</li>
              <li>That your WhatsApp account will not be subject to rate-limiting or bans</li>
            </ul>
            <p>Use at your own risk. The anti-ban features are provided as safeguards but do not guarantee account safety.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle size={18} className="text-warning" /> Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary leading-relaxed">
            <p>In no event shall the authors be liable for any damages arising from the use or inability to use this software, including but not limited to WhatsApp account restrictions or bans.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
