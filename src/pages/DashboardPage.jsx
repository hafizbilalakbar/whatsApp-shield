import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Activity, Globe, ClipboardList, Shield, Zap } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import { cn } from '../components/ui/cn';

// Steps
import Step1Auth from '../components/dashboard/Step1Auth';
import Step2Audience from '../components/dashboard/Step2Audience';
import Step3Safety from '../components/dashboard/Step3Safety';
import Step4Scanning from '../components/dashboard/Step4Scanning';
import Step5Reports from '../components/dashboard/Step5Reports';
import StepProgress from '../components/dashboard/StepProgress';

const STEPS = [
  { id: 1, name: 'Authenticate', icon: ShieldCheck, description: 'Link session' },
  { id: 2, name: 'Audience', icon: Globe, description: 'Setup numbers' },
  { id: 3, name: 'Safety / Anti-ban', icon: Shield, description: 'Anti-ban settings' },
  { id: 4, name: 'Live Scan', icon: Activity, description: 'Validation' },
  { id: 5, name: 'Reports', icon: ClipboardList, description: 'Audit & Export' },
];

const ConnectionChip = ({ isChecking, isConnected }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
      isChecking
        ? "bg-success/5 border-success/25 text-success"
        : isConnected
        ? "bg-success/5 border-success/25 text-success"
        : "bg-error/5 border-error/25 text-error"
    )}
    role="status"
  >
    {isChecking ? (
      <>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        Scanning
      </>
    ) : isConnected ? (
      <>
        <span className="inline-flex rounded-full h-2 w-2 bg-success" />
        Connected
      </>
    ) : (
      <>
        <span className="inline-flex rounded-full h-2 w-2 bg-error animate-pulse" />
        Not Connected
      </>
    )}
  </span>
);

const DashboardPage = () => {
  const { isConnected, isChecking, isAuthenticated } = useWebSocket();

  // If already authenticated on mount, skip directly to step 2
  const [currentStep, setCurrentStep] = useState(() => {
    return isConnected && isAuthenticated ? 2 : 1;
  });

  const [maxUnlockedStep, setMaxUnlockedStep] = useState(() => {
    return isConnected && isAuthenticated ? 2 : 1;
  });
  const [stepError, setStepError] = useState('');
  const stepErrorTimer = useRef(null);

  // Reset to step 1 on disconnect; Step1Auth handles auto-advance on connect
  useEffect(() => {
    if (!isConnected) {
      setCurrentStep(prev => prev > 1 ? 1 : prev);
      setMaxUnlockedStep(1);
    }
  }, [isConnected]);

  // Jump to scanning if checking starts
  useEffect(() => {
    if (isChecking) {
      setCurrentStep(prev => prev < 4 ? 4 : prev);
      setMaxUnlockedStep(prev => prev < 4 ? 4 : prev);
    }
  }, [isChecking]);

  // Clear any pending error timer on unmount
  useEffect(() => {
    return () => {
      if (stepErrorTimer.current) clearTimeout(stepErrorTimer.current);
    };
  }, []);

  const showStepError = (msg) => {
    setStepError(msg);
    if (stepErrorTimer.current) clearTimeout(stepErrorTimer.current);
    stepErrorTimer.current = setTimeout(() => setStepError(''), 4000);
  };

  const handleNext = () => {
    // Security checkpoints
    if (currentStep === 1 && !isConnected) {
      return showStepError('Please authenticate before continuing.');
    }
    if (currentStep === 2) {
      const audience = window.__whatsappShieldAudience || [];
      if (audience.length < 1 || !audience.some(n => n.valid !== false)) {
        return showStepError('Please add at least one valid phone number to continue.');
      }
    }
    // Step 4 → 5 (reports): the user is allowed to reach the report as soon as
    // the scan reached a terminal state. Do NOT gate on `status === 'CONNECTED'`
    // — a transient WebSocket reconnect (which can briefly make `status` anything
    // other than CONNECTED) must not make the "View Report" button hang or error.
    const next = Math.min(currentStep + 1, 5);
    setCurrentStep(next);
    setMaxUnlockedStep(prev => Math.max(prev, next));
  };

  const handlePrev = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step) => {
    if (step > maxUnlockedStep) {
      return showStepError('Complete the current step first to unlock this section.');
    }
    setCurrentStep(step);
  };

  return (
    <div className="app-container flex flex-col gap-6 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mt-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 items-center justify-center text-primary shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold">Shield Workspace</h1>
            <p className="text-text-secondary mt-1 text-sm">
              Configure your audience, apply anti-ban safeguards, and launch validations safely.
            </p>
          </div>
        </div>
        <ConnectionChip isChecking={isChecking} isConnected={isConnected} />
      </div>

      {/* Security checkpoint error */}
      {stepError && (
        <div className="bg-error/10 border border-error/30 text-error rounded-lg px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
          <Zap size={14} className="shrink-0" />
          {stepError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-stretch">

        {/* Stepper (Sidebar on Desktop, Top bar on Mobile) */}
        <aside className="w-full lg:w-72 shrink-0 mt-4 lg:mt-0">
          <div className="lg:sticky lg:top-24 lg:rounded-2xl lg:border lg:border-border lg:bg-surface lg:shadow-sm lg:p-5">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-4">
              <Shield size={11} className="text-primary" /> Security Workflow
            </div>
            <StepProgress
              steps={STEPS}
              currentStep={currentStep}
              onStepClick={goToStep}
              maxUnlockedStep={maxUnlockedStep}
            />
          </div>
        </aside>

        {/* Step Content Area */}
        <div className="flex-grow min-w-0">
          <div className="relative bg-surface border border-border rounded-2xl shadow-sm min-h-[520px] overflow-hidden flex flex-col">
            {/* Accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#34D399] to-secondary z-10" aria-hidden="true" />

            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full flex-1 p-4 sm:p-6 lg:p-8"
                >
                  {currentStep === 1 && <Step1Auth onNext={handleNext} />}
                  {currentStep === 2 && <Step2Audience onNext={handleNext} onPrev={handlePrev} />}
                  {currentStep === 3 && <Step3Safety onNext={handleNext} onPrev={handlePrev} />}
                  {currentStep === 4 && <Step4Scanning onNext={handleNext} />}
                  {currentStep === 5 && <Step5Reports />}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;