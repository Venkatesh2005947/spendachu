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
  ShieldCheck,
  Check,
  TrendingUp,
  Camera,
  Layers,
  Award
} from 'lucide-react';
import './OnboardingTutorial.css';

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: 'Welcome to SpendAchu 👋',
    subtitle: 'Your Smart AI Financial Assistant',
    icon: Sparkles,
    badge: 'Dashboard & Overview',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    highlights: [
      'Real-time monthly spending tracking',
      '3-Column metric summary & budget limit gauge',
      'Instant insights & category analytics'
    ],
    description: (name) => `Vanakkam ${name || 'User'}! Welcome to SpendAchu. Manage your daily money, save for dream goals, and ask AI anything in English or Tanglish.`
  },
  {
    id: 2,
    title: 'Track Expenses in Seconds 💳',
    subtitle: 'Categorized Spending & Filters',
    icon: CreditCard,
    badge: 'Expense Management',
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
    highlights: [
      'Categorized logging (Food, Rent, Fuel, Shopping)',
      'Support for UPI, Cash, & Card payment methods',
      'Instant date, category & amount filtering'
    ],
    description: () => 'Log every transaction effortlessly. Filter expenses by date ranges, edit entries on the fly, and download CSV reports whenever you need.'
  },
  {
    id: 3,
    title: 'AI Copilot & OCR Scanner 🤖',
    subtitle: 'Natural Language AI & Receipt Reader',
    icon: Bot,
    badge: 'Ask AI & Receipt OCR',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
    highlights: [
      'Type or ask questions in Tanglish or English',
      'Camera Receipt Scanner for instant bill entry',
      'Automatic duplicate transaction warnings'
    ],
    description: () => 'Click the "Ask AI" button in the header bar anytime! Type "Spent 200 for tea" or "Iniku evlo spend pannen?" to get instant smart answers.'
  },
  {
    id: 4,
    title: 'Savings Stash & Dream Goals 🎯',
    subtitle: 'Set Targets & Build Wealth',
    icon: Target,
    badge: 'Financial Goals',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    highlights: [
      'Set goal targets (Laptop, Bike, Emergency Fund)',
      'Visual progress bar & celebratory milestones',
      'Deposit savings into dedicated goal buckets'
    ],
    description: () => 'Turn your financial aspirations into reality. Track your savings deposits and celebrate when you hit 100% of your targets!'
  },
  {
    id: 5,
    title: 'Custom Themes & Profile 🌙',
    subtitle: 'Personalize Your Experience',
    icon: SunMoon,
    badge: 'Theme & Profile Settings',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    highlights: [
      'Sleek Dark Mode & Vibrant Light Mode toggle',
      'Profile avatar & personal settings management',
      'Recycle bin for recently deleted entries'
    ],
    description: () => 'Switch between dark and light themes using the header toggle. Recover deleted transactions anytime from the Recently Deleted tab.'
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
          <div className="onboarding-brand-tag">
            <Zap size={14} className="brand-icon-zap" />
            <span>SpendAchu Tour</span>
          </div>

          {/* Interactive Step Indicator Dots */}
          <div className="onboarding-step-dots">
            {TUTORIAL_STEPS.map((step, idx) => (
              <button
                key={step.id}
                className={`step-dot ${idx === currentStep ? 'active' : ''} ${idx < currentStep ? 'completed' : ''}`}
                onClick={() => setCurrentStep(idx)}
                title={`Go to Step ${idx + 1}: ${step.title}`}
              >
                {idx < currentStep ? <Check size={10} /> : idx + 1}
              </button>
            ))}
          </div>

          <button 
            className="onboarding-close-btn" 
            onClick={handleSkip}
            title="Skip Tour"
          >
            <span>Skip</span>
            <X size={15} />
          </button>
        </div>

        {/* Card Body Content */}
        <div className="onboarding-body">
          {/* Main Hero Icon Circle with Subtle Glow */}
          <div className="hero-icon-container">
            <div 
              className="onboarding-icon-circle"
              style={{ background: stepData.gradient }}
            >
              <StepIcon size={38} color="#ffffff" />
            </div>
            <div className="hero-badge-chip">
              <ShieldCheck size={13} />
              <span>{stepData.badge}</span>
            </div>
          </div>

          {/* Step Headers */}
          <h2 className="onboarding-title">{stepData.title}</h2>
          <div className="onboarding-subtitle">{stepData.subtitle}</div>

          <p className="onboarding-description">
            {stepData.description(userName)}
          </p>

          {/* Feature Highlights Grid */}
          <div className="onboarding-highlights-box">
            {stepData.highlights.map((item, i) => (
              <div key={i} className="highlight-item">
                <div className="highlight-check-icon">
                  <CheckCircle2 size={15} />
                </div>
                <span>{item}</span>
              </div>
            ))}
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

          <div className="onboarding-footer-right">
            <span className="step-counter-text">
              {currentStep + 1} / {TUTORIAL_STEPS.length}
            </span>
            <button 
              className="primary-btn onboarding-btn-next"
              onClick={handleNext}
              style={{ background: stepData.gradient }}
            >
              <span>{isLastStep ? 'Explore App 🎉' : 'Next Step'}</span>
              {isLastStep ? <Award size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
