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

const ConnectionChip = ({ isChecking, isConnected, connecting }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all",
      isChecking
        ? "bg-success/10 border-success/30 text-success shadow-xs"
        : isConnected
        ? "bg-success/10 border-success/30 text-success shadow-xs"
        : connecting
        ? "bg-warning/10 border-warning/30 text-warning"
        : "bg-error/10 border-error/30 text-error animate-pulse"
    )}
    role="status"
  >
    {isChecking ? (
      <>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        Scanning Active
      </>
    ) : isConnected ? (
      <>
        <span className="inline-flex rounded-full h-2 w-2 bg-success" />
        Connected
      </>
    ) : connecting ? (
      <>
        <svg className="animate-spin h-3 w-3 text-warning" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        Connecting
      </>
    ) : (
      <>
        <span className="inline-flex rounded-full h-2 w-2 bg-error" />
        Not Connected
      </>
    )}
  </span>
);

const DashboardPage = () => {
  const { isConnected, isChecking, isAuthenticated, status, sessionResolved, reconnecting } = useWebSocket();

  // If already authenticated (cached or confirmed), skip straight to step 2 so a
  // refresh never paints the QR/login step first.
  const [currentStep, setCurrentStep] = useState(() => (isAuthenticated ? 2 : 1));

  const [maxUnlockedStep, setMaxUnlockedStep] = useState(() => (isAuthenticated ? 2 : 1));
  const [stepError, setStepError] = useState('');
  const stepErrorTimer = useRef(null);
  const workspaceRef = useRef(null);
  const didMountScroll = useRef(false);

  // Auto-advance to step 2 when the session is authenticated — not gated on the
  // transport being OPEN, so a transient drop (still authenticated) never bounces
  // the user back to login.
  useEffect(() => {
    if (isAuthenticated && currentStep === 1) {
      setCurrentStep(2);
      setMaxUnlockedStep((prev) => Math.max(prev, 2));
    }
  }, [isAuthenticated, currentStep]);

  // Keep the viewport aligned to the top of the workspace whenever active step changes.
  useEffect(() => {
    if (!didMountScroll.current) {
      didMountScroll.current = true;
      return;
    }
    const el = workspaceRef.current;
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = el.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [currentStep]);

  // Reset to step 1 only on a genuine logout (backend confirmed, no session) —
  // never on a bare transport disconnect.
  useEffect(() => {
    if (sessionResolved && !isAuthenticated) {
      setCurrentStep(prev => prev > 1 ? 1 : prev);
      setMaxUnlockedStep(1);
    }
  }, [sessionResolved, isAuthenticated]);

  // Jump to scanning if checking starts
  useEffect(() => {
    if (isChecking) {
      setCurrentStep(prev => prev < 4 ? 4 : prev);
      setMaxUnlockedStep(prev => prev < 4 ? 4 : prev);
    }
  }, [isChecking]);

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
    if (currentStep === 1 && !isAuthenticated) {
      return showStepError('Please authenticate before continuing.');
    }
    if (currentStep === 2) {
      const audience = window.__whatsappShieldAudience || [];
      if (audience.length < 1 || !audience.some(n => n.valid !== false)) {
        return showStepError('Please add at least one valid phone number to continue.');
      }
    }
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
    <div className="app-container page-top-spacing flex flex-col gap-4 sm:gap-6 pb-12 w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
            <ShieldCheck size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-display font-bold text-text-primary tracking-tight">
              Shield Workspace
            </h1>
            <p className="text-text-secondary text-xs truncate">
              Configure audience, apply anti-ban safeguards, and launch validations safely.
            </p>
          </div>
        </div>
        <ConnectionChip isChecking={isChecking} isConnected={isConnected} connecting={!isAuthenticated && (status === 'CONNECTING' || reconnecting || !sessionResolved)} />
      </div>

      {/* Security checkpoint error */}
      {stepError && (
        <div className="bg-error/10 border border-error/30 text-error rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
          <Zap size={13} className="shrink-0" />
          {stepError}
        </div>
      )}

      {/* Main Workspace Layout (Sidebar + Step Content) */}
      <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 lg:gap-5 items-stretch w-full min-w-0">

        {/* Stepper (Sidebar on Desktop, Horizontal Bar on Tablet/Mobile) */}
        <aside className="w-full lg:w-56 xl:w-64 shrink-0">
          <div className="lg:sticky lg:top-24 rounded-2xl border border-border bg-surface shadow-2xs p-3 sm:p-3.5 lg:p-4">
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-3">
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
        <div className="flex-1 min-w-0">
          <div
            ref={workspaceRef}
            className="relative bg-surface border border-border rounded-2xl shadow-2xs min-h-[460px] lg:min-h-[500px] overflow-hidden flex flex-col w-full"
          >
            {/* Top Accent Gradient Bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-[#34D399] to-secondary z-10" aria-hidden="true" />

            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full flex-1 p-3 sm:p-4 md:p-5 lg:p-6"
                >
                  {currentStep === 1 && !sessionResolved && !isAuthenticated ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted space-y-4">
                      <div className="relative">
                        <div className="w-14 h-14 border-4 border-border rounded-full animate-pulse" />
                        <div className="w-14 h-14 border-4 border-primary rounded-full border-t-transparent animate-spin absolute inset-0" />
                      </div>
                      <p className="text-sm">Restoring your session…</p>
                    </div>
                  ) : (
                    <>
                      {currentStep === 1 && <Step1Auth onNext={handleNext} />}
                      {currentStep === 2 && <Step2Audience onNext={handleNext} onPrev={handlePrev} />}
                      {currentStep === 3 && <Step3Safety onNext={handleNext} onPrev={handlePrev} />}
                      {currentStep === 4 && <Step4Scanning onNext={handleNext} />}
                      {currentStep === 5 && <Step5Reports />}
                    </>
                  )}
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