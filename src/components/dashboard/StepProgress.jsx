import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../ui/cn';

const StepProgress = ({ steps, currentStep, onStepClick, maxUnlockedStep }) => {
  const getConnectorPercent = () => {
    if (currentStep <= 1) return '0%';
    return `${((currentStep - 1) / (steps.length - 1)) * 100}%`;
  };

  return (
    <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-stretch gap-1.5 lg:gap-4 xl:gap-5 relative">
      
      {/* Background Connector Line (Desktop - vertical) */}
      <div 
        className="hidden lg:block absolute left-[18px] top-[18px] bottom-[18px] w-0.5 bg-border/60 -z-10" 
        aria-hidden="true" 
      />
      
      {/* Background Connector Line (Mobile - horizontal) */}
      <div 
        className="block lg:hidden absolute top-[15px] left-[15px] right-[15px] h-0.5 bg-border/60 -z-10" 
        aria-hidden="true" 
      />

      {/* Active Line (Desktop - vertical) */}
      <div 
        className="hidden lg:block absolute left-[18px] top-[18px] w-0.5 bg-gradient-to-b from-primary to-emerald-400 transition-all duration-500 ease-out -z-10"
        style={{ height: currentStep > 1 ? getConnectorPercent() : '0%' }}
        aria-hidden="true" 
      />
      
      {/* Active Line (Mobile - horizontal) */}
      <div 
        className="block lg:hidden absolute top-[15px] left-[15px] h-0.5 bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500 ease-out -z-10"
        style={{ width: currentStep > 1 ? getConnectorPercent() : '0%' }}
        aria-hidden="true" 
      />

      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isPending = step.id > currentStep;
        const isClickable = step.id <= maxUnlockedStep;

        return (
          <button
            key={step.id}
            type="button"
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "flex flex-row items-center gap-2 lg:gap-3 group relative text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl transition-all p-1 lg:p-1.5 bg-transparent select-none",
              !isClickable && "cursor-not-allowed opacity-45",
              isClickable && !isActive && "hover:bg-primary/[0.04] cursor-pointer"
            )}
            title={step.description}
          >
            {/* Step Circle Indicator */}
            <div className={cn(
              "w-7 h-7 sm:w-7.5 sm:h-7.5 lg:w-8 lg:h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative shrink-0 z-10",
              isCompleted && "border-primary bg-primary text-white shadow-xs",
              isActive && "border-primary bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,217,126,0.25)] ring-2 ring-primary/20 scale-105",
              isPending && "border-border bg-surface text-text-muted"
            )}>
              {isCompleted ? (
                <Check size={13} className="text-white" strokeWidth={3} />
              ) : (
                <step.icon size={13} strokeWidth={isActive ? 2.5 : 2} />
              )}
            </div>

            {/* Step Label (Desktop & Tablet) */}
            <div className="hidden sm:flex flex-col items-start min-w-0 flex-1 bg-transparent">
              <span className={cn(
                "text-xs lg:text-xs xl:text-sm font-display font-semibold tracking-tight truncate leading-tight bg-transparent",
                isActive ? "text-primary" : (isCompleted ? "text-text-primary" : "text-text-muted group-hover:text-text-secondary")
              )}>
                {step.name}
              </span>
              <span className="hidden lg:block text-[10px] xl:text-[11px] text-text-muted mt-0.5 truncate leading-tight bg-transparent">
                {step.description}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default StepProgress;
