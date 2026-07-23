import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Activity, Globe, ClipboardList, Shield } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';
import ErrorBoundary from '../components/ErrorBoundary';

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

window.onerror = (msg, src, line, col, err) => console.error('GLOBAL CRASH:', msg, src, line, col, err);

const DashboardPage = () => {
  const { isConnected, isChecking, status, isAuthenticated } = useWebSocket();

  // If already authenticated on mount, skip directly to step 2
  const [currentStep, setCurrentStep] = useState(() => {
    return isConnected && isAuthenticated ? 2 : 1;
  });

  const [maxUnlockedStep, setMaxUnlockedStep] = useState(() => {
    return isConnected && isAuthenticated ? 2 : 1;
  });
  const [stepError, setStepError] = useState('');

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

  const showStepError = (msg) => {
    setStepError(msg);
    setTimeout(() => setStepError(''), 4000);
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
    if (currentStep === 4 && status !== 'CONNECTED') {
      return showStepError('Scanning session is not active. Reconnect and try again.');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mt-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Workspace</h1>
          <p className="text-text-secondary mt-1">Configure your audience and launch validations safely.</p>
        </div>
      </div>

      {/* Security checkpoint error */}
      {stepError && (
        <div className="bg-error/10 border border-error/30 text-error rounded-lg px-4 py-3 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {stepError}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Stepper (Sidebar on Desktop, Top bar on Mobile) */}
        <div className="w-full lg:w-64 shrink-0">
          <StepProgress 
            steps={STEPS} 
            currentStep={currentStep} 
            onStepClick={goToStep} 
            maxUnlockedStep={maxUnlockedStep}
          />
        </div>

        {/* Step Content Area */}
        <div className="flex-grow">
          <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[500px] relative overflow-hidden">
            <ErrorBoundary>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full p-4 sm:p-6 md:p-8"
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
