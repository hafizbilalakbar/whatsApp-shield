import React, { useState, useEffect } from 'react';
import { X, Building2, Save, Loader2, Globe, Mail, Phone, MapPin, FileText, Shield, Eye, EyeOff } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { useMessageAgent } from '../MessageAgentPage';

const BusinessProfileSettings = ({ isOpen, onClose }) => {
  const { businessProfile, loadBusinessProfile } = useMessageAgent();
  const [profile, setProfile] = useState({
    companyName: '',
    description: '',
    industry: '',
    website: '',
    email: '',
    phone: '',
    address: '',
    logo: '',
    tagline: '',
    visibility: {
      showCompanyName: true,
      showPhone: true,
      showEmail: true,
      showWebsite: true,
      showAddress: true,
    },
    ...businessProfile
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadBusinessProfile();
    }
  }, [isOpen, loadBusinessProfile]);

  useEffect(() => {
    if (businessProfile) {
      setProfile(prev => ({
        ...prev,
        ...businessProfile,
        visibility: { ...prev.visibility, ...(businessProfile.visibility || {}) }
      }));
    }
  }, [businessProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/message-agent/business-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (res.ok) {
        loadBusinessProfile();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) {
      console.error('Error saving business profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const toggleVisibility = (field) => {
    setProfile(prev => ({
      ...prev,
      visibility: { ...prev.visibility, [field]: !prev.visibility[field] }
    }));
  };

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-info/10 flex items-center justify-center">
                <Building2 size={16} className="text-info" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">Business Profile</h2>
                <p className="text-xs text-text-secondary">Manage your business identity and privacy settings</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface transition-colors">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Business Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Building2 size={14} className="text-primary" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Company Name *</label>
                  <Input
                    value={profile.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder="Your Company Name"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Tagline</label>
                  <Input
                    value={profile.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    placeholder="Brief tagline or slogan"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Description</label>
                <textarea
                  value={profile.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Describe your business..."
                  className="w-full min-h-[60px] p-2.5 rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-xs"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Industry</label>
                  <Input
                    value={profile.industry}
                    onChange={(e) => updateField('industry', e.target.value)}
                    placeholder="e.g., Technology, Retail"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Logo URL</label>
                  <Input
                    value={profile.logo}
                    onChange={(e) => updateField('logo', e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Phone size={14} className="text-success" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Business Email</label>
                  <div className="relative">
                    <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={profile.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="business@company.com"
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Business Phone</label>
                  <div className="relative">
                    <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={profile.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Website</label>
                  <div className="relative">
                    <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={profile.website}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="https://yourwebsite.com"
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-text-muted uppercase tracking-wider mb-1.5 block">Address</label>
                  <div className="relative">
                    <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={profile.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Business address"
                      className="pl-9 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Shield size={14} className="text-warning" />
                Privacy & Visibility Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-[11px] text-text-secondary mb-3">Choose what information is visible to contacts during conversations</p>
              <div className="space-y-2">
                {[
                  { key: 'showCompanyName', label: 'Company Name', icon: Building2 },
                  { key: 'showPhone', label: 'Phone Number', icon: Phone },
                  { key: 'showEmail', label: 'Email Address', icon: Mail },
                  { key: 'showWebsite', label: 'Website', icon: Globe },
                  { key: 'showAddress', label: 'Address', icon: MapPin },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-2.5 rounded-lg bg-background border border-border">
                    <div className="flex items-center gap-3">
                      <item.icon size={14} className="text-text-muted" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    <Switch
                      checked={profile.visibility?.[item.key] !== false}
                      onCheckedChange={() => toggleVisibility(item.key)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {profile.companyName && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Eye size={14} className="text-info" />
                  Profile Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="p-3 rounded-xl bg-background border border-border">
                  <div className="flex items-start gap-3">
                    {profile.logo && (
                      <img src={profile.logo} alt="Logo" className="w-10 h-10 rounded-lg object-cover border border-border" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-text-primary">{profile.companyName}</h3>
                      {profile.tagline && <p className="text-[11px] text-text-secondary italic">{profile.tagline}</p>}
                      {profile.description && <p className="text-[11px] text-text-secondary mt-1">{profile.description}</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {profile.industry && <Badge variant="secondary" className="text-[10px]">{profile.industry}</Badge>}
                        {profile.visibility?.showWebsite && profile.website && (
                          <span className="text-[10px] text-primary">{profile.website}</span>
                        )}
                        {profile.visibility?.showEmail && profile.email && (
                          <span className="text-[10px] text-text-muted">{profile.email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <Badge variant="success" className="text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Saved successfully
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={isSaving || !profile.companyName.trim()}
              className="bg-primary hover:bg-primary/90 text-white text-xs h-8"
            >
              {isSaving ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Save size={12} className="mr-1.5" />}
              Save Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { BusinessProfileSettings };
