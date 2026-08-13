import React, { useState } from 'react';
import { 
  Sparkles, 
  CreditCard, 
  Bot, 
  Target, 
  SunMoon, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  CheckCircle2, 
  Zap,
  ShieldCheck
} from 'lucide-react';
import './OnboardingTutorial.css';

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: 'Welcome to SpendAchu!',
    subtitle: 'Smart Budgeting & AI Financial Assistant',
    icon: Sparkles,
    badge: 'Dashboard & Overview',
    gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    description: (name) => `Welcome, ${name || 'User'}! Take a quick 1-minute tour to discover how SpendAchu helps you track expenses, manage savings, and achieve your financial goals effortlessly.`
  },
  {
    id: 2,
    title: 'Track Your Expenses',
    subtitle: 'Instant Entry & Category Icons',
    icon: CreditCard,
    badge: 'Expense List & Filters',
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    description: () => 'Log daily expenses in seconds with payment methods (Cash, UPI, Card) and category icons. View all transactions in a clean list and edit or delete entries anytime.'
  },
  {
    id: 3,
    title: 'AskSpendAchu AI & Scanner',
    subtitle: 'Smart AI Insights & Camera OCR',
    icon: Bot,
    badge: 'AI Assistant & Receipt OCR',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    description: () => 'Ask financial questions in natural English or Tanglish! You can also snap photos of paper receipts with the camera scanner for automatic entry logging.'
  },
  {
    id: 4,
    title: 'Savings & Dream Goals',
    subtitle: 'Set Targets & Track Progress',
    icon: Target,
    badge: 'Savings Stash & Targets',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    description: () => 'Stash money into your savings balance and set financial goals (e.g. Laptop, Bike, Vacation) with real-time visual progress bars.'
  },
  {
    id: 5,
    title: 'Themes & Account Settings',
    subtitle: 'Light/Dark Mode & Profile Controls',
    icon: SunMoon,
    badge: 'Theme Toggle & Profile Avatar',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    description: () => 'Toggle seamlessly between Dark and Light themes anytime using the header icon. Click your profile avatar to manage your account details.'
  }
];

export default function OnboardingTutorial({ isOpen, onClose, onComplete, userName }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const stepData = TUTORIAL_STEPS[currentStep];
  const StepIcon = stepData.icon;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="onboarding-overlay" onClick={handleSkip}>
      <div 
        className="glass-card onboarding-card" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar with Skip button */}
        <div className="onboarding-header">
          <div className="onboarding-badge-pill">
            <Zap size={13} />
            <span>Website Tour</span>
          </div>
          <button 
            className="onboarding-close-btn" 
            onClick={handleSkip}
            title="Skip Tour"
          >
            <span>Skip Tour</span>
            <X size={16} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="onboarding-progress-track">
          <div 
            className="onboarding-progress-fill" 
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Card Body Content */}
        <div className="onboarding-body">
          {/* Main Hero Icon Circle */}
          <div 
            className="onboarding-icon-circle"
            style={{ background: stepData.gradient }}
          >
            <StepIcon size={34} color="#ffffff" />
          </div>

          <span className="onboarding-step-counter">
            Step {currentStep + 1} of {TUTORIAL_STEPS.length}
          </span>

          <h2 className="onboarding-title">{stepData.title}</h2>
          <div className="onboarding-subtitle">{stepData.subtitle}</div>

          <p className="onboarding-description">
            {stepData.description(userName)}
          </p>

          <div className="onboarding-feature-tag">
            <ShieldCheck size={14} />
            <span>{stepData.badge}</span>
          </div>
        </div>

        {/* Footer Navigation Buttons */}
        <div className="onboarding-footer">
          {!isFirstStep ? (
            <button 
              className="outline-btn onboarding-btn-back"
              onClick={handleBack}
            >
              <ChevronLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <button 
            className="glow-btn onboarding-btn-next"
            onClick={handleNext}
          >
            <span>{isLastStep ? 'Get Started!' : 'Next'}</span>
            {isLastStep ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
