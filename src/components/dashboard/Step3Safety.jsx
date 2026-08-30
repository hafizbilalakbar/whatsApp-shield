import React, { useState, useEffect, useRef } from 'react';
import { Shield, ShieldAlert, ArrowRight, ArrowLeft, Clock, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/Badge';

const Step3Safety = ({ onNext, onPrev }) => {
  const [shieldMode, setShieldMode] = useState(true);
  const [baseDelay, setBaseDelay] = useState(3000);
  const [jitter] = useState(50); // percentage (backend applies ±50% around baseDelay)
  
  // The range slider writes to a local draft state instantly (so dragging feels
  // fluid and never lags) and pushes the debounced value into `baseDelay` only
  // after the user stops moving it. This removes the jitter/repaint lag the
  // range input experienced before.
  const [sliderDraft, setSliderDraft] = useState(baseDelay);
  const commitTimer = useRef(null);
  useEffect(() => {
    return () => { if (commitTimer.current) clearTimeout(commitTimer.current); };
  }, []);
  const handleSliderChange = (e) => {
    const v = parseInt(e.target.value, 10);
    setSliderDraft(v);
    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => setBaseDelay(v), 120);
  };
  
  // Calculate total audience size passed from Step 2
  const audienceSize = window.whatsappShieldAudience ? window.whatsappShieldAudience.length : 0;
  
  // Calculate estimated time
  const [eta, setEta] = useState('');
  
  useEffect(() => {
    if (audienceSize === 0) {
      setEta('0m 0s');
      return;
    }
    
    // Average delay is baseDelay if shield mode is off
    // If shield mode is on, random delay is between (baseDelay * 0.5) and
    // (baseDelay * 1.5) — averaging baseDelay — plus a 5s cool-down every 10
    // numbers. Both figures mirror the backend enforcement exactly.
    let totalMs = 0;
    
    if (!shieldMode) {
      // Backend fast mode: Math.max(1000, baseDelay * 0.3) per check.
      const fastAvg = Math.max(1000, baseDelay * 0.3);
      totalMs = fastAvg * audienceSize;
    } else {
      const avgDelay = baseDelay; 
      totalMs = (avgDelay * audienceSize) + (Math.floor(audienceSize / 10) * 5000);
    }
    
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      setEta(`~${hours}h ${remainingMins}m`);
    } else {
      setEta(`~${minutes}m ${seconds}s`);
    }
  }, [shieldMode, baseDelay, audienceSize]);

  // Logout cleanup handled by WebSocketProvider — no per-step window global cleanup needed

  const handleContinue = () => {
    // Store settings globally for Step 4 to consume when calling the API
    window.whatsappShieldSettings = {
      shieldMode,
      delayMs: baseDelay,
      jitter
    };
    onNext();
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-display font-semibold flex items-center gap-2">
            <Shield className="text-primary" /> Safety Protocols
          </h2>
          <p className="text-text-secondary mt-1">Configure anti-ban delays to protect your connected WhatsApp account.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow min-h-0">
        
        {/* Left Col: Settings */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className={`border-2 transition-colors ${shieldMode ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    Shield Mode Protection
                    {shieldMode ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </h3>
                  <p className="text-text-secondary text-sm mt-1 max-w-md">
                    Enables algorithmic jitter (randomized delays) and automatic cool-down periods to simulate human behavior and prevent algorithmic flagging.
                  </p>
                </div>
                <div className="mt-1">
                  <Switch 
                    checked={shieldMode} 
                    onCheckedChange={setShieldMode} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-grow">
            <CardContent className="p-4 md:p-6 space-y-6">
              {/* Base Delay */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <div>
                    <label className="font-semibold block">Base Delay Between Checks</label>
                    <span className="text-sm text-text-secondary">Time to wait before validating the next number.</span>
                  </div>
                  <div className="font-mono bg-surface border border-border px-3 py-1 rounded-md">
                    {(sliderDraft / 1000).toFixed(1)}s
                  </div>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="10000" 
                  step="500" 
                  value={sliderDraft} 
                  onChange={handleSliderChange}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-text-muted font-mono">
                  <span>0.5s (Fast/Risky)</span>
                  <span>10.0s (Safe)</span>
                </div>
              </div>

              {/* Jitter (enforced by backend automatically when shield is on) */}
              <div className={`space-y-4 transition-opacity ${!shieldMode ? 'opacity-40 pointer-events-none' : ''}`}>
                <div className="flex justify-between">
                  <div>
                    <label className="font-semibold flex items-center gap-2 block">
                      <Zap size={16} className="text-warning" /> 
                      Algorithmic Jitter
                    </label>
                    <span className="text-sm text-text-secondary">Randomizes the base delay by ±50%.</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-border rounded-full overflow-hidden relative">
                  <div 
                    className="absolute top-0 bottom-0 bg-primary/50" 
                    style={{ left: '25%', width: '50%' }} 
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-background -translate-x-1/2" />
                </div>
                <p className="text-xs text-text-muted">
                  Actual delay will randomly fluctuate between {((baseDelay * 0.5) / 1000).toFixed(1)}s and {((baseDelay * 1.5) / 1000).toFixed(1)}s, plus a 5s cool-down every 10 checks.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Summary & Alerts */}
        <div className="flex flex-col gap-4">
          {!shieldMode && (
             <div className="bg-error/10 border border-error/20 p-4 rounded-xl flex gap-3 items-start animate-in fade-in zoom-in-95">
               <ShieldAlert size={20} className="text-error shrink-0 mt-0.5" />
               <div>
                 <h4 className="font-semibold text-error mb-1">Account at Risk</h4>
                 <p className="text-sm text-error/90">
                   Disabling Shield Mode exposes your account to algorithmic detection. You may be banned if you process a large list without jitter or cool-downs.
                 </p>
               </div>
             </div>
          )}

          <Card className="bg-background/50 flex-grow">
            <CardContent className="p-4 md:p-6 flex flex-col justify-center h-full">
              <div className="text-center space-y-2 mb-4 md:mb-6">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto mb-3 md:mb-4 text-primary">
                  <Clock size={20} className="md:w-6 md:h-6" />
                </div>
                <h3 className="font-display font-semibold text-base md:text-lg">Estimated Time</h3>
                <div className="text-2xl md:text-3xl font-mono font-bold text-text-primary tracking-tight">
                  {eta}
                </div>
                <p className="text-text-secondary text-xs md:text-sm">
                  To process {audienceSize.toLocaleString()} numbers
                </p>
              </div>
            </CardContent>
          </Card>
          
          <div className="mt-auto flex gap-3 pt-4">
            <Button variant="outline" onClick={onPrev} className="px-3">
              <ArrowLeft size={16} />
            </Button>
            <Button 
              className="flex-1" 
              onClick={handleContinue}
              variant={!shieldMode ? "destructive" : "default"}
            >
              Start Validation <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Step3Safety;
