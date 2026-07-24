import React, { useState, useEffect } from 'react';
import { Shield, Clock, MessageSquare, Users, AlertTriangle, Timer, Zap, Eye, EyeOff, Settings, ChevronDown, ChevronRight, Activity, Globe } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Switch';
import { Input } from '../../components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select';
import { useMessageAgent } from '../MessageAgentPage';

const defaultSafetySettings = {
  antiBan: {
    enabled: true,
    messageDelay: { min: 2, max: 5 },
    typingSimulation: true,
    typingDuration: { min: 1, max: 3 },
    messageHumanization: true,
    randomEmojis: false,
    duplicateMessageFilter: true,
  },
  rateLimiting: {
    enabled: true,
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 200,
    cooldownAfterBurst: { messages: 10, pauseMinutes: 5 },
  },
  sessionSafety: {
    businessHoursOnly: false,
    businessHours: { start: '09:00', end: '18:00' },
    randomOnlineStatus: true,
    cooldownBetweenChats: { min: 30, max: 120 },
    maxConcurrentChats: 5,
  },
  messageSafety: {
    lengthVariation: true,
    emojiRandomization: true,
    greetingVariation: true,
    smartReplyDelay: true,
    avoidRepetition: true,
    contentFiltering: true,
  },
  monitoring: {
    alertsEnabled: true,
    banRiskThreshold: 70,
    autoPauseOnRisk: true,
    dailyReportEmail: false,
    logAllMessages: true,
  },
};

const SafetySettings = ({ isOpen, onClose }) => {
  const { safetySettings, setSafetySettings } = useMessageAgent();
  const [activeSection, setActiveSection] = useState('antiban');
  const [settings, setSettings] = useState(safetySettings || defaultSafetySettings);

  const updateSetting = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
  };

  const updateNestedSetting = (category, key, subKey, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: {
          ...prev[category][key],
          [subKey]: value,
        },
      },
    }));
  };

  const saveSettings = () => {
    setSafetySettings(settings);
    localStorage.setItem('whatsapp_shield_safety_settings', JSON.stringify(settings));
    onClose?.();
  };

  const sections = [
    { id: 'antiban', label: 'Anti-Ban', icon: Shield, color: 'text-success' },
    { id: 'ratelimit', label: 'Rate Limiting', icon: Timer, color: 'text-warning' },
    { id: 'session', label: 'Session Safety', icon: Eye, color: 'text-primary' },
    { id: 'message', label: 'Message Safety', icon: MessageSquare, color: 'text-info' },
    { id: 'monitoring', label: 'Monitoring', icon: Activity, color: 'text-error' },
  ];

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
        <div className="p-3 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-success/10 flex items-center justify-center">
                <Shield size={14} className="text-success" />
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-text-primary">Safety & Anti-Ban Settings</h2>
                <p className="text-xs text-text-secondary">Configure protection features for your WhatsApp account</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Protection Active
              </Badge>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                <span className="text-lg">×</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 border-r border-border bg-background/50 p-3 shrink-0 overflow-y-auto">
            <nav className="space-y-1">
              {sections.map(section => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all",
                      activeSection === section.id
                        ? "bg-surface border border-border text-text-primary shadow-sm"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface/50"
                    )}
                  >
                    <Icon size={14} className={section.color} />
                    {section.label}
                    {activeSection === section.id && <ChevronRight size={12} className="ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3">
            {activeSection === 'antiban' && (
              <div className="space-y-3">
                <SectionHeader
                  title="Anti-Ban Protection"
                  description="Humanize message patterns to avoid WhatsApp detection algorithms"
                  icon={Shield}
                  enabled={settings.antiBan.enabled}
                  onToggle={(val) => updateSetting('antiBan', 'enabled', val)}
                />

                <SettingGroup title="Message Timing">
                  <SettingRow
                    label="Random Delay Between Messages"
                    description="Add random delay between outgoing messages"
                    control={
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.antiBan.messageDelay.min}
                          onChange={(e) => updateNestedSetting('antiBan', 'messageDelay', 'min', parseInt(e.target.value) || 1)}
                          className="w-20 h-8 text-xs"
                          min={1}
                        />
                        <span className="text-xs text-text-muted">to</span>
                        <Input
                          type="number"
                          value={settings.antiBan.messageDelay.max}
                          onChange={(e) => updateNestedSetting('antiBan', 'messageDelay', 'max', parseInt(e.target.value) || 5)}
                          className="w-20 h-8 text-xs"
                          min={1}
                        />
                        <span className="text-xs text-text-muted">sec</span>
                      </div>
                    }
                  />
                  <SettingRow
                    label="Typing Simulation"
                    description="Show typing indicator before sending (mimics human behavior)"
                    control={
                      <Switch
                        checked={settings.antiBan.typingSimulation}
                        onCheckedChange={(val) => updateSetting('antiBan', 'typingSimulation', val)}
                      />
                    }
                  />
                  {settings.antiBan.typingSimulation && (
                    <SettingRow
                      label="Typing Duration"
                      description="How long to show typing indicator"
                      control={
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={settings.antiBan.typingDuration.min}
                            onChange={(e) => updateNestedSetting('antiBan', 'typingDuration', 'min', parseInt(e.target.value) || 1)}
                            className="w-20 h-8 text-xs"
                            min={1}
                          />
                          <span className="text-xs text-text-muted">to</span>
                          <Input
                            type="number"
                            value={settings.antiBan.typingDuration.max}
                            onChange={(e) => updateNestedSetting('antiBan', 'typingDuration', 'max', parseInt(e.target.value) || 3)}
                            className="w-20 h-8 text-xs"
                            min={1}
                          />
                          <span className="text-xs text-text-muted">sec</span>
                        </div>
                      }
                    />
                  )}
                </SettingGroup>

                <SettingGroup title="Message Humanization">
                  <SettingRow
                    label="Message Humanization"
                    description="Add natural variations to message text"
                    control={
                      <Switch
                        checked={settings.antiBan.messageHumanization}
                        onCheckedChange={(val) => updateSetting('antiBan', 'messageHumanization', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Random Emoji Insertion"
                    description="Occasionally add emojis to messages for natural feel"
                    control={
                      <Switch
                        checked={settings.antiBan.randomEmojis}
                        onCheckedChange={(val) => updateSetting('antiBan', 'randomEmojis', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Duplicate Message Filter"
                    description="Prevent sending identical messages in sequence"
                    control={
                      <Switch
                        checked={settings.antiBan.duplicateMessageFilter}
                        onCheckedChange={(val) => updateSetting('antiBan', 'duplicateMessageFilter', val)}
                      />
                    }
                  />
                </SettingGroup>
              </div>
            )}

            {activeSection === 'ratelimit' && (
              <div className="space-y-3">
                <SectionHeader
                  title="Rate Limiting"
                  description="Control message throughput to stay within safe limits"
                  icon={Timer}
                  enabled={settings.rateLimiting.enabled}
                  onToggle={(val) => updateSetting('rateLimiting', 'enabled', val)}
                />

                <SettingGroup title="Message Limits">
                  <SettingRow
                    label="Max Messages per Minute"
                    control={
                      <Input
                        type="number"
                        value={settings.rateLimiting.maxPerMinute}
                        onChange={(e) => updateSetting('rateLimiting', 'maxPerMinute', parseInt(e.target.value) || 5)}
                        className="w-24 h-8 text-xs"
                        min={1}
                        max={20}
                      />
                    }
                  />
                  <SettingRow
                    label="Max Messages per Hour"
                    control={
                      <Input
                        type="number"
                        value={settings.rateLimiting.maxPerHour}
                        onChange={(e) => updateSetting('rateLimiting', 'maxPerHour', parseInt(e.target.value) || 30)}
                        className="w-24 h-8 text-xs"
                        min={1}
                        max={200}
                      />
                    }
                  />
                  <SettingRow
                    label="Max Messages per Day"
                    control={
                      <Input
                        type="number"
                        value={settings.rateLimiting.maxPerDay}
                        onChange={(e) => updateSetting('rateLimiting', 'maxPerDay', parseInt(e.target.value) || 200)}
                        className="w-24 h-8 text-xs"
                        min={1}
                        max={1000}
                      />
                    }
                  />
                </SettingGroup>

                <SettingGroup title="Cooldown Settings">
                  <SettingRow
                    label="Pause After Burst"
                    description="Auto-pause after sending multiple messages quickly"
                    control={
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.rateLimiting.cooldownAfterBurst.messages}
                          onChange={(e) => updateNestedSetting('rateLimiting', 'cooldownAfterBurst', 'messages', parseInt(e.target.value) || 10)}
                          className="w-16 h-8 text-xs"
                          min={1}
                        />
                        <span className="text-xs text-text-muted">msgs →</span>
                        <Input
                          type="number"
                          value={settings.rateLimiting.cooldownAfterBurst.pauseMinutes}
                          onChange={(e) => updateNestedSetting('rateLimiting', 'cooldownAfterBurst', 'pauseMinutes', parseInt(e.target.value) || 5)}
                          className="w-16 h-8 text-xs"
                          min={1}
                        />
                        <span className="text-xs text-text-muted">min pause</span>
                      </div>
                    }
                  />
                </SettingGroup>
              </div>
            )}

            {activeSection === 'session' && (
              <div className="space-y-3">
                <SectionHeader
                  title="Session Safety"
                  description="Protect your WhatsApp session from suspicious activity"
                  icon={Eye}
                  enabled={settings.sessionSafety.businessHoursOnly}
                  onToggle={(val) => updateSetting('sessionSafety', 'businessHoursOnly', val)}
                  toggleLabel="Business Hours Only"
                />

                <SettingGroup title="Operating Hours">
                  <SettingRow
                    label="Business Hours Only"
                    description="Only send messages during business hours"
                    control={
                      <Switch
                        checked={settings.sessionSafety.businessHoursOnly}
                        onCheckedChange={(val) => updateSetting('sessionSafety', 'businessHoursOnly', val)}
                      />
                    }
                  />
                  {settings.sessionSafety.businessHoursOnly && (
                    <SettingRow
                      label="Business Hours"
                      control={
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={settings.sessionSafety.businessHours.start}
                            onChange={(e) => updateNestedSetting('sessionSafety', 'businessHours', 'start', e.target.value)}
                            className="w-32 h-8 text-xs"
                          />
                          <span className="text-xs text-text-muted">to</span>
                          <Input
                            type="time"
                            value={settings.sessionSafety.businessHours.end}
                            onChange={(e) => updateNestedSetting('sessionSafety', 'businessHours', 'end', e.target.value)}
                            className="w-32 h-8 text-xs"
                          />
                        </div>
                      }
                    />
                  )}
                </SettingGroup>

                <SettingGroup title="Session Behavior">
                  <SettingRow
                    label="Random Online Status"
                    description="Simulate random online/offline status changes"
                    control={
                      <Switch
                        checked={settings.sessionSafety.randomOnlineStatus}
                        onCheckedChange={(val) => updateSetting('sessionSafety', 'randomOnlineStatus', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Cooldown Between Chats"
                    description="Pause between switching conversations"
                    control={
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={settings.sessionSafety.cooldownBetweenChats.min}
                          onChange={(e) => updateNestedSetting('sessionSafety', 'cooldownBetweenChats', 'min', parseInt(e.target.value) || 30)}
                          className="w-20 h-8 text-xs"
                          min={10}
                        />
                        <span className="text-xs text-text-muted">to</span>
                        <Input
                          type="number"
                          value={settings.sessionSafety.cooldownBetweenChats.max}
                          onChange={(e) => updateNestedSetting('sessionSafety', 'cooldownBetweenChats', 'max', parseInt(e.target.value) || 120)}
                          className="w-20 h-8 text-xs"
                          min={10}
                        />
                        <span className="text-xs text-text-muted">sec</span>
                      </div>
                    }
                  />
                  <SettingRow
                    label="Max Concurrent Chats"
                    description="Maximum number of simultaneous active chats"
                    control={
                      <Input
                        type="number"
                        value={settings.sessionSafety.maxConcurrentChats}
                        onChange={(e) => updateSetting('sessionSafety', 'maxConcurrentChats', parseInt(e.target.value) || 5)}
                        className="w-24 h-8 text-xs"
                        min={1}
                        max={20}
                      />
                    }
                  />
                </SettingGroup>
              </div>
            )}

            {activeSection === 'message' && (
              <div className="space-y-3">
                <SectionHeader
                  title="Message Safety"
                  description="Smart message handling to avoid detection patterns"
                  icon={MessageSquare}
                  enabled={true}
                  hideToggle
                />

                <SettingGroup title="Content Protection">
                  <SettingRow
                    label="Message Length Variation"
                    description="Slightly vary message lengths for natural patterns"
                    control={
                      <Switch
                        checked={settings.messageSafety.lengthVariation}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'lengthVariation', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Emoji Randomization"
                    description="Vary emoji usage across messages"
                    control={
                      <Switch
                        checked={settings.messageSafety.emojiRandomization}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'emojiRandomization', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Greeting Variation"
                    description="Use different greetings to avoid pattern detection"
                    control={
                      <Switch
                        checked={settings.messageSafety.greetingVariation}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'greetingVariation', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Smart Reply Delay"
                    description="Vary response times based on message complexity"
                    control={
                      <Switch
                        checked={settings.messageSafety.smartReplyDelay}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'smartReplyDelay', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Avoid Repetition"
                    description="Never send the same message to the same person twice"
                    control={
                      <Switch
                        checked={settings.messageSafety.avoidRepetition}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'avoidRepetition', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Content Filtering"
                    description="Filter messages for potentially risky content"
                    control={
                      <Switch
                        checked={settings.messageSafety.contentFiltering}
                        onCheckedChange={(val) => updateSetting('messageSafety', 'contentFiltering', val)}
                      />
                    }
                  />
                </SettingGroup>
              </div>
            )}

            {activeSection === 'monitoring' && (
              <div className="space-y-3">
                <SectionHeader
                  title="Monitoring & Alerts"
                  description="Monitor account health and receive ban risk alerts"
                  icon={Activity}
                  enabled={settings.monitoring.alertsEnabled}
                  onToggle={(val) => updateSetting('monitoring', 'alertsEnabled', val)}
                />

                <SettingGroup title="Risk Detection">
                  <SettingRow
                    label="Ban Risk Threshold"
                    description="Alert when risk score exceeds this percentage"
                    control={
                      <div className="flex items-center gap-2">
                        <Input
                          type="range"
                          min={10}
                          max={100}
                          value={settings.monitoring.banRiskThreshold}
                          onChange={(e) => updateSetting('monitoring', 'banRiskThreshold', parseInt(e.target.value))}
                          className="w-32"
                        />
                        <Badge variant={settings.monitoring.banRiskThreshold > 80 ? 'destructive' : settings.monitoring.banRiskThreshold > 50 ? 'warning' : 'success'}>
                          {settings.monitoring.banRiskThreshold}%
                        </Badge>
                      </div>
                    }
                  />
                  <SettingRow
                    label="Auto-Pause on Risk"
                    description="Automatically pause messaging when risk threshold is reached"
                    control={
                      <Switch
                        checked={settings.monitoring.autoPauseOnRisk}
                        onCheckedChange={(val) => updateSetting('monitoring', 'autoPauseOnRisk', val)}
                      />
                    }
                  />
                </SettingGroup>

                <SettingGroup title="Logging">
                  <SettingRow
                    label="Log All Messages"
                    description="Keep detailed logs of all sent/received messages"
                    control={
                      <Switch
                        checked={settings.monitoring.logAllMessages}
                        onCheckedChange={(val) => updateSetting('monitoring', 'logAllMessages', val)}
                      />
                    }
                  />
                  <SettingRow
                    label="Daily Report Email"
                    description="Receive daily activity summary via email"
                    control={
                      <Switch
                        checked={settings.monitoring.dailyReportEmail}
                        onCheckedChange={(val) => updateSetting('monitoring', 'dailyReportEmail', val)}
                      />
                    }
                  />
                </SettingGroup>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-surface/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <AlertTriangle size={12} className="text-warning" />
            <span>Changes take effect immediately. Keep conservative settings for safest operation.</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={saveSettings} className="bg-success hover:bg-success/90 text-white">
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, description, icon: Icon, enabled, onToggle, toggleLabel, hideToggle }) => (
  <div className="flex items-start justify-between pb-3 border-b border-border">
    <div className="flex items-start gap-2">
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", enabled ? "bg-success/10" : "bg-surface border border-border")}>
        <Icon size={16} className={enabled ? "text-success" : "text-text-muted"} />
      </div>
      <div>
        <h3 className="text-base font-display font-semibold text-text-primary">{title}</h3>
        <p className="text-xs text-text-secondary mt-0.5">{description}</p>
      </div>
    </div>
    {!hideToggle && onToggle && (
      <Switch checked={enabled} onCheckedChange={onToggle} />
    )}
  </div>
);

const SettingGroup = ({ title, children }) => (
  <div className="space-y-0">
    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</h4>
    <div className="bg-background/50 border border-border rounded-xl divide-y divide-border">
      {children}
    </div>
  </div>
);

const SettingRow = ({ label, description, control }) => (
  <div className="flex items-center justify-between p-2.5">
    <div className="flex-1 min-w-0 mr-4">
      <p className="text-xs font-medium text-text-primary">{label}</p>
      {description && <p className="text-[11px] text-text-muted mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

export { SafetySettings };
