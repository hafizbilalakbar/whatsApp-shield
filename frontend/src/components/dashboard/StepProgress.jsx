import React from 'react';
import { Check, XCircle } from 'lucide-react';
import { cn } from '../ui/cn';
import { useTheme } from '../../context/ThemeProvider';

const StepProgress = ({ steps, currentStep, onStepClick, maxUnlockedStep }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const getConnectorPercent = () => {
    if (currentStep <= 1) return '0%';
    return `${((currentStep - 1) / (steps.length - 1)) * 100}%`;
  };

  return (
    <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-stretch lg:items-stretch gap-0 lg:gap-8 relative">
      
      {/* Background Line (Desktop - vertical) */}
      <div className={cn(
        "hidden lg:block absolute left-[21px] lg:left-[23px] top-[20px] bottom-[20px] w-0.5 -z-10 transition-colors duration-300",
        isDark ? 'bg-[#1F2937]' : 'bg-gray-200'
      )} />
      {/* Background Line (Mobile - horizontal) */}
      <div className={cn(
        "block lg:hidden absolute top-[18px] left-[20px] right-[20px] h-0.5 -z-10 transition-colors duration-300",
        isDark ? 'bg-[#1F2937]' : 'bg-gray-200'
      )} />

      {/* Active Line (Desktop - vertical) */}
      <div 
        className="hidden lg:block absolute left-[21px] lg:left-[23px] top-[20px] w-0.5 bg-primary transition-all duration-700 ease-in-out -z-10"
        style={{ height: currentStep > 1 ? getConnectorPercent() : '0%' }}
      />
      
      {/* Active Line (Mobile - horizontal) */}
      <div 
        className="block lg:hidden absolute top-[18px] left-[20px] h-0.5 bg-primary transition-all duration-700 ease-in-out -z-10"
        style={{ width: currentStep > 1 ? getConnectorPercent() : '0%' }}
      />

      {steps.map((step) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;
        const isPending = step.id > currentStep;
        const isClickable = step.id <= maxUnlockedStep;

        return (
          <button
            key={step.id}
            onClick={() => isClickable && onStepClick(step.id)}
            disabled={!isClickable}
            className={cn(
              "flex flex-row items-center gap-1 lg:gap-4 group relative focus:outline-none flex-1 lg:flex-initial min-w-0 px-1 py-1 lg:py-0",
              !isClickable && "cursor-not-allowed opacity-50"
            )}
            title={step.description}
          >
            {/* Circle Indicator */}
            <div className={cn(
              "w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative shrink-0 z-10",
              isCompleted && "border-primary bg-primary text-white",
              isActive && "border-primary text-primary shadow-[0_0_15px_rgba(0,217,126,0.2)]",
              isPending && (isDark ? 'border-[#1F2937] text-[#6B7280]' : 'border-gray-300 text-gray-400')
            )}>
              {isCompleted ? (
                <Check size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={3} />
              ) : (
                <step.icon size={16} className="md:w-[18px] md:h-[18px]" strokeWidth={isActive ? 2.5 : 2} />
              )}
              
              {/* Pulse Ring for Active Step */}
              {isActive && (
                <div className="absolute inset-[-3px] md:inset-[-4px] rounded-full border border-primary/50 animate-ping opacity-75 pointer-events-none" />
              )}
            </div>

            {/* Label - Responsive: icon only on mobile, short label on tablet, full label on desktop */}
            {/* Short name (visible sm-lg) */}
            <div className={cn(
              "hidden sm:flex lg:hidden flex-col items-center lg:items-start text-center lg:text-left mt-0 min-w-0"
            )}>
              <span className={cn(
                "text-xs font-semibold transition-colors font-display tracking-tight truncate max-w-[80px]",
                isActive ? "text-primary" : (isPending ? (isDark ? 'text-[#6B7280]' : 'text-gray-400') : 'text-text-primary')
              )}>
                {step.name}
              </span>
            </div>

            {/* Full name + description (visible lg+) */}
            <div className={cn(
              "hidden lg:flex flex-col items-start text-left mt-0 min-w-0"
            )}>
              <span className={cn(
                "text-xs md:text-sm font-semibold transition-colors font-display tracking-tight truncate max-w-[160px]",
                isActive ? "text-primary" : (isPending ? (isDark ? 'text-[#6B7280]' : 'text-gray-400') : 'text-text-primary')
              )}>
                {step.name}
              </span>
              <span className={cn(
                "text-xs mt-0.5 truncate max-w-[160px]",
                isDark ? 'text-[#9CA3AF]' : 'text-gray-500'
              )}>
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
