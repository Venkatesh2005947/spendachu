import React, { useState, useEffect, useRef } from 'react';
import { Plus, Menu, X, Bell, Sparkles, Camera } from 'lucide-react';

// Services
import { dbService } from './services/db';
import { aiService } from './services/ai';

// Components
import Sidebar from './components/Sidebar/Sidebar';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import ForgotPassword from './components/Auth/ForgotPassword';
import StatCards from './components/Dashboard/StatCards';
import AnalyticsCharts from './components/Dashboard/AnalyticsCharts';
import ExpenseForm from './components/ExpenseForm/ExpenseForm';
import ExpenseFilters from './components/ExpenseList/ExpenseFilters';
import ExpenseTable from './components/ExpenseList/ExpenseTable';
import BudgetLimits from './components/Budgeting/BudgetLimits';
import InsightsPanel from './components/AIInsights/InsightsPanel';
import SavingForm from './components/SavingForm/SavingForm';
import SavingTable from './components/SavingForm/SavingTable';
import RecentlyDeleted from './components/RecentlyDeleted/RecentlyDeleted';
import FeedbackForm from './components/Feedback/FeedbackForm';
import ReceiptPreview from './components/ReceiptPreview/ReceiptPreview';
import DuplicateWarning from './components/DuplicateWarning/DuplicateWarning';
import FinancialGoals from './components/Dashboard/FinancialGoals';
import GoalForm from './components/Dashboard/GoalForm';
import AddGoalSavingsModal from './components/Dashboard/AddGoalSavingsModal';
import GoalCompletedModal from './components/Dashboard/GoalCompletedModal';
import AchievementsList from './components/Dashboard/AchievementsList';
import AchievementUnlockModal from './components/Dashboard/AchievementUnlockModal';
import FinancialHealthCard from './components/Dashboard/FinancialHealthCard';
import FinancialHealthModal from './components/Dashboard/FinancialHealthModal';
import AdminNotifications from './components/Admin/AdminNotifications';
import AdminAnalytics from './components/Admin/AdminAnalytics';
import NotificationCenter from './components/Notifications/NotificationCenter';
import NotificationsPage from './components/Notifications/NotificationsPage';

export default function App() {
  // 1. Session and Auth State
  const [user, setUser] = useState(null);
  const [authScreen, setAuthScreen] = useState('login'); // 'login' | 'signup' | 'forgot'
  
  // 2. Application states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expenses, setExpenses] = useState([]);
  const [savings, setSavings] = useState([]);
  const [trash, setTrash] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [currencyCode, setCurrencyCode] = useState('INR');
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tracker_theme') || 'dark';
  });
  
  // 3. UI control states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]); // Dynamic budget alerts
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [isReceiptPreviewOpen, setIsReceiptPreviewOpen] = useState(false);
  const [capturedFile, setCapturedFile] = useState(null);     // File object from camera
  const [capturePreviewUrl, setCapturePreviewUrl] = useState(null); // Object URL for preview
  const fileInputRef = useRef(null);
  // duplicateWarning: null | { confidence, existing, pendingPayload, source: 'manual'|'scan' }
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // 5. Goals State
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [isAddGoalSavingsOpen, setIsAddGoalSavingsOpen] = useState(false);
  const [selectedGoalForSavings, setSelectedGoalForSavings] = useState(null);
  const [completedGoalCelebration, setCompletedGoalCelebration] = useState(null);

  // 6. Achievements State
  const [achievementsData, setAchievementsData] = useState({ achievements: [], totalPoints: 0 });
  const [achievementsLoading, setAchievementsLoading] = useState(false);
  const [unlockedAchievementsQueue, setUnlockedAchievementsQueue] = useState([]);

  // Dashboard month selector (defaults to current month)
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // 4. Filters state
  const [filters, setFilters] = useState({
    dateRange: 'all',
    customStart: '',
    customEnd: '',
    category: 'all',
    paymentMethod: 'all',
    minAmount: '',
    maxAmount: ''
  });

  // Verify and load active session on startup
  useEffect(() => {
    const activeUser = dbService.getCurrentUser();
    if (activeUser) {
      handleLoginSuccess(activeUser);
    }
    
    // Load preferred theme
    const savedTheme = localStorage.getItem('tracker_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Sync dataset document theme when state changes
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('tracker_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // 7. Financial Health State
  const [financialHealth, setFinancialHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState(null);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const fetchFinancialHealth = async () => {
    try {
      setHealthLoading(true);
      setHealthError(null);
      const health = await dbService.getFinancialHealth();
      setFinancialHealth(health);
    } catch (err) {
      console.error('Failed to calculate financial health score:', err);
      setHealthError('Failed to load Financial Health Score.');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleLoginSuccess = async (loggedInUser) => {
    setUser(loggedInUser);
    
    try {
      // Fetch user-isolated financial data
      const [records, limits, savingsList, trashList, goalsList, achs] = await Promise.all([
        dbService.getExpenses(),
        dbService.getBudgets(),
        dbService.getSavings(),
        dbService.getTrash(),
        dbService.getGoals().catch(() => []),
        dbService.getAchievements().catch(() => ({ achievements: [], totalPoints: 0 }))
      ]);
      
      setExpenses(records);
      setBudgets(limits);
      setSavings(savingsList);
      setTrash(trashList);
      setGoals(goalsList);
      setAchievementsData(achs);

      fetchFinancialHealth();

      // Queue congratulations for any unlocked but unseen achievements from offline/updates
      const unseenUnlocked = (achs?.achievements || []).filter(a => a.unlocked && !a.seen);
      if (unseenUnlocked.length > 0) {
        setUnlockedAchievementsQueue(unseenUnlocked);
      }

      // Fetch user currency setting if saved
      const savedCurrency = localStorage.getItem(`tracker_currency_${loggedInUser.email}`) || 'INR';
      setCurrencyCode(savedCurrency);
    } catch (err) {
      console.error('Failed to load database states:', err);
    }

    // Reset view variables
    setActiveTab('dashboard');
    setAuthScreen('login');
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const performLogout = () => {
    dbService.logout();
    setUser(null);
    setExpenses([]);
    setSavings([]);
    setTrash([]);
    setBudgets({});
    setNotifications([]);
    setGoals([]);
    setAchievementsData({ achievements: [], totalPoints: 0 });
    setUnlockedAchievementsQueue([]);
  };

  const handleSaveExpense = async (payload) => {
    try {
      if (editingExpense && editingExpense.id) {
        // Update action — no duplicate check needed for edits
        await dbService.updateExpense(editingExpense.id, payload);
      } else {
        // Add action — check for duplicates
        const result = await dbService.addExpense(payload);
        if (result && result.isDuplicate) {
          // Pause and ask the user what to do
          setDuplicateWarning({
            confidence: result.confidence,
            existing: result.existing,
            pendingPayload: payload,
            source: 'manual'
          });
          return; // Do NOT close the expense modal yet
        }
        
        // Intercept any newly unlocked achievements
        if (result && result.unlockedAchievements && result.unlockedAchievements.length > 0) {
          setUnlockedAchievementsQueue(prev => [...prev, ...result.unlockedAchievements]);
          const updatedAchs = await dbService.getAchievements();
          setAchievementsData(updatedAchs);
        }
      }

      // Reload database states
      const updatedExpenses = await dbService.getExpenses();
      setExpenses(updatedExpenses);
      setIsExpenseModalOpen(false);
      setEditingExpense(null);

      // Trigger instant check for budget warnings & update score
      checkBudgetAlerts(updatedExpenses, budgets);
      fetchFinancialHealth();
    } catch (err) {
      console.error('Failed to save expense:', err);
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      await dbService.deleteExpense(id);
      const updatedExpenses = await dbService.getExpenses();
      const updatedTrash = await dbService.getTrash();
      setExpenses(updatedExpenses);
      setTrash(updatedTrash);

      // Trigger instant check for budget warnings & update score
      checkBudgetAlerts(updatedExpenses, budgets);
      fetchFinancialHealth();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  const handleSaveBudgets = async (updatedBudgets) => {
    try {
      const limits = await dbService.updateBudgets(updatedBudgets);
      setBudgets(limits);
      checkBudgetAlerts(expenses, limits);
    } catch (err) {
      console.error('Failed to save budgets:', err);
    }
  };

  const handleClearAllExpenses = async () => {
    try {
      const cleared = await dbService.clearAllExpenses();
      const updatedTrash = await dbService.getTrash();
      setExpenses(cleared);
      setTrash(updatedTrash);
      checkBudgetAlerts(cleared, budgets);
    } catch (err) {
      console.error('Failed to clear expenses:', err);
    }
  };

  const handleSaveSaving = async (payload) => {
    try {
      const res = await dbService.addSaving(payload);
      const updatedSavings = await dbService.getSavings();
      setSavings(updatedSavings);
      setIsSavingModalOpen(false);

      // Check for newly unlocked achievements
      if (res && res.unlockedAchievements && res.unlockedAchievements.length > 0) {
        setUnlockedAchievementsQueue(prev => [...prev, ...res.unlockedAchievements]);
        const updatedAchs = await dbService.getAchievements();
        setAchievementsData(updatedAchs);
      }
    } catch (err) {
      console.error('Failed to save saving:', err);
    }
  };

  const handleDeleteSaving = async (id) => {
    try {
      await dbService.deleteSaving(id);
      const updatedSavings = await dbService.getSavings();
      const updatedTrash = await dbService.getTrash();
      setSavings(updatedSavings);
      setTrash(updatedTrash);
    } catch (err) {
      console.error('Failed to delete saving:', err);
    }
  };

  const handleClearAllSavings = async () => {
    try {
      const cleared = await dbService.clearAllSavings();
      const updatedTrash = await dbService.getTrash();
      setSavings(cleared);
      setTrash(updatedTrash);
    } catch (err) {
      console.error('Failed to clear savings:', err);
    }
  };

  const handleRestoreItem = async (id) => {
    try {
      await dbService.restoreItem(id);
      const [updatedExpenses, updatedSavings, updatedTrash] = await Promise.all([
        dbService.getExpenses(),
        dbService.getSavings(),
        dbService.getTrash()
      ]);
      setExpenses(updatedExpenses);
      setSavings(updatedSavings);
      setTrash(updatedTrash);
    } catch (err) {
      console.error('Failed to restore item:', err);
    }
  };

  const handlePermanentDeleteItem = async (id) => {
    try {
      await dbService.permanentDeleteItem(id);
      const updatedTrash = await dbService.getTrash();
      setTrash(updatedTrash);
    } catch (err) {
      console.error('Failed to permanently delete item:', err);
    }
  };

  const handleClearTrash = async () => {
    try {
      await dbService.clearTrash();
      const updatedTrash = await dbService.getTrash();
      setTrash(updatedTrash);
    } catch (err) {
      console.error('Failed to clear trash:', err);
    }
  };



  const handleSaveCurrency = (code) => {
    setCurrencyCode(code);
    if (user) {
      localStorage.setItem(`tracker_currency_${user.email}`, code);
    }
  };

  // Inspect expense summaries and budget constraints to issue user alerts
  const checkBudgetAlerts = (records, limits) => {
    if (!limits || records.length === 0) return;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthSpent = records
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const alerts = [];
    const globalLimit = limits.global || 50000;
    
    if (thisMonthSpent >= globalLimit) {
      alerts.push(`🚨 Critical: You have exceeded your overall monthly budget limit of ₹${globalLimit}!`);
    } else if (thisMonthSpent >= globalLimit * 0.8) {
      alerts.push(`⚠️ Warning: You have utilized over 80% of your global monthly budget!`);
    }

    setNotifications(alerts);
  };

  // Run alerts evaluation when expenses or budgets update
  useEffect(() => {
    if (user && expenses.length > 0 && Object.keys(budgets).length > 0) {
      checkBudgetAlerts(expenses, budgets);
    }
  }, [expenses, budgets, user]);

  const openAddModal = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  const triggerFileSelect = () => {
    const input = fileInputRef.current;
    if (input) {
      input.value = '';   // reset so same file can be selected again
      input.click();
    }
  };

  // Called when user clicks "Retake" in the capture preview
  const handleRetake = () => {
    if (capturePreviewUrl) {
      URL.revokeObjectURL(capturePreviewUrl);
    }
    setCapturePreviewUrl(null);
    setCapturedFile(null);
    triggerFileSelect();
  };

  // Called when user clicks "Continue" in the capture preview — runs OCR
  const handleContinueToOCR = async () => {
    if (!capturedFile) return;
    // Revoke preview URL before starting scan
    if (capturePreviewUrl) {
      URL.revokeObjectURL(capturePreviewUrl);
      setCapturePreviewUrl(null);
    }
    const file = capturedFile;
    setCapturedFile(null);
    try {
      setIsScanning(true);
      const { base64, mimeType } = await resizeImage(file);
      const result = await dbService.scanReceipt(base64, mimeType);
      setIsScanning(false);
      if (result && !result.error) {
        setScanResult(result);
        setIsReceiptPreviewOpen(true);
      } else {
        alert('Could not scan receipt. Please enter the details manually.');
      }
    } catch (err) {
      setIsScanning(false);
      console.error('Scan Error:', err);
      alert(err.message || 'Failed to scan receipt. Please ensure the OCR service is running.');
    }
  };

  const resizeImage = (file, maxDimension = 1024) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({
          base64: dataUrl.split(',')[1],
          mimeType: 'image/jpeg'
        });
      };
      img.onerror = (err) => reject(err);
    });
  };

  const handleReceiptScan = (e) => {
    const file = e.target.files[0];
    // User dismissed the picker / cancelled
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please capture or upload a valid receipt image (JPEG, PNG, etc.).');
      e.target.value = '';
      return;
    }

    // Revoke any previous preview URL to avoid memory leaks
    if (capturePreviewUrl) {
      URL.revokeObjectURL(capturePreviewUrl);
    }

    // Create a new object URL for the preview and store the raw File
    const url = URL.createObjectURL(file);
    setCapturedFile(file);
    setCapturePreviewUrl(url);
  };

  const handleSaveScannedExpense = async (payload) => {
    try {
      const result = await dbService.addExpense({ ...payload, isScanned: true });
      if (result && result.isDuplicate) {
        // Pause receipt preview and ask the user
        setDuplicateWarning({
          confidence: result.confidence,
          existing: result.existing,
          pendingPayload: payload,
          source: 'scan'
        });
        return; // Keep receipt preview open in background
      }
      // Refresh expenses list
      const updated = await dbService.getExpenses();
      setExpenses(updated);
      setIsReceiptPreviewOpen(false);
      setScanResult(null);

      // Check for newly unlocked achievements
      if (result && result.unlockedAchievements && result.unlockedAchievements.length > 0) {
        setUnlockedAchievementsQueue(prev => [...prev, ...result.unlockedAchievements]);
        const updatedAchs = await dbService.getAchievements();
        setAchievementsData(updatedAchs);
      }
    } catch (err) {
      console.error('Failed to save scanned expense:', err);
      alert(err.message || 'Failed to save expense.');
    }
  };

  // ── Goals Handlers ──────────────────────────────────────────────────────
  const handleSaveGoal = async (payload) => {
    try {
      let res;
      if (editingGoal) {
        const prevStatus = editingGoal.status;
        res = await dbService.updateGoal(editingGoal.id, payload);
        
        // Show celebration only if transitioned to completed now
        if (res.status === 'completed' && prevStatus !== 'completed') {
          setCompletedGoalCelebration(res);
        }
      } else {
        res = await dbService.addGoal(payload);
        if (res.status === 'completed') {
          setCompletedGoalCelebration(res);
        }
      }
      
      const updatedGoals = await dbService.getGoals();
      setGoals(updatedGoals);
      setIsGoalFormOpen(false);
      setEditingGoal(null);

      // Check for newly unlocked achievements
      if (res && res.unlockedAchievements && res.unlockedAchievements.length > 0) {
        setUnlockedAchievementsQueue(prev => [...prev, ...res.unlockedAchievements]);
        const updatedAchs = await dbService.getAchievements();
        setAchievementsData(updatedAchs);
      }
    } catch (err) {
      console.error('Failed to save goal:', err);
      alert(err.message || 'Failed to save goal.');
    }
  };

  const handleUpdateGoalStatus = async (id, updatedGoalData) => {
    try {
      if (updatedGoalData) {
        // Toggle paused/active or cancelled status
        await dbService.updateGoal(id, updatedGoalData);
      } else {
        // Direct edit trigger — find goal in list and open editor modal
        const goalToEdit = goals.find(g => g.id === id);
        if (goalToEdit) {
          setEditingGoal(goalToEdit);
          setIsGoalFormOpen(true);
        }
      }
      const updatedGoals = await dbService.getGoals();
      setGoals(updatedGoals);
    } catch (err) {
      console.error('Failed to update goal status:', err);
      alert(err.message || 'Failed to update goal.');
    }
  };

  const handleDeleteGoal = async (id) => {
    try {
      await dbService.deleteGoal(id);
      const updatedGoals = await dbService.getGoals();
      setGoals(updatedGoals);
    } catch (err) {
      console.error('Failed to delete goal:', err);
      alert(err.message || 'Failed to delete goal.');
    }
  };

  const handleDepositGoalSavings = async (amount, allowExceed) => {
    if (!selectedGoalForSavings) return;
    try {
      const res = await dbService.addSavingsToGoal(selectedGoalForSavings.id, amount, allowExceed);
      if (res.completed) {
        // Show celebration
        const completedGoal = goals.find(g => g.id === selectedGoalForSavings.id);
        if (completedGoal) {
          setCompletedGoalCelebration({
            ...completedGoal,
            savedAmount: res.savedAmount,
            status: res.status
          });
        }
      }
      
      const updatedGoals = await dbService.getGoals();
      setGoals(updatedGoals);
      setIsAddGoalSavingsOpen(false);
      setSelectedGoalForSavings(null);

      // Check for newly unlocked achievements
      if (res && res.unlockedAchievements && res.unlockedAchievements.length > 0) {
        setUnlockedAchievementsQueue(prev => [...prev, ...res.unlockedAchievements]);
        const updatedAchs = await dbService.getAchievements();
        setAchievementsData(updatedAchs);
      }
    } catch (err) {
      console.error('Failed to deposit savings to goal:', err);
      alert(err.message || 'Failed to deposit savings.');
    }
  };

  const handleDismissUnlockModal = async (id) => {
    // Remove from active modal queue
    setUnlockedAchievementsQueue(prev => prev.filter(a => a.id !== id));
    try {
      await dbService.markAchievementsSeen([id]);
      const updatedAchs = await dbService.getAchievements();
      setAchievementsData(updatedAchs);
    } catch (err) {
      console.error('Failed to mark achievement as seen:', err);
    }
  };
  // ────────────────────────────────────────────────────────────────────────

  // ── Duplicate Warning handlers ──────────────────────────────────────────
  const handleDuplicateAddAnyway = async () => {
    if (!duplicateWarning) return;
    const { pendingPayload, source } = duplicateWarning;
    setDuplicateWarning(null);
    try {
      await dbService.addExpense({ ...pendingPayload, forceCreate: true });
      const updated = await dbService.getExpenses();
      setExpenses(updated);
      checkBudgetAlerts(updated, budgets);
      if (source === 'manual') {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
      } else {
        setIsReceiptPreviewOpen(false);
        setScanResult(null);
      }
    } catch (err) {
      console.error('Failed to force-save expense:', err);
      alert(err.message || 'Failed to save expense.');
    }
  };

  const handleDuplicateCancel = () => {
    setDuplicateWarning(null);
    // Leave the expense/receipt form open so the user can edit or dismiss it
  };

  const handleDuplicateViewExisting = () => {
    setDuplicateWarning(null);
    // Close whichever form was open and land on the expenses tab
    setIsExpenseModalOpen(false);
    setEditingExpense(null);
    setIsReceiptPreviewOpen(false);
    setScanResult(null);
    setActiveTab('expenses');
  };
  // ────────────────────────────────────────────────────────────────────────



  // Render Auth views if session is empty
  if (!user) {
    if (authScreen === 'signup') {
      return <Signup onSignupSuccess={() => setAuthScreen('login')} onLoginClick={() => setAuthScreen('login')} />;
    }
    if (authScreen === 'forgot') {
      return <ForgotPassword onBackToLogin={() => setAuthScreen('login')} />;
    }
    return (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onSignupClick={() => setAuthScreen('signup')} 
        onForgotClick={() => setAuthScreen('forgot')} 
      />
    );
  }

  // Get active tab page view
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': {
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

        // Build last 13 months for the picker dropdown
        const monthOptions = [];
        for (let i = 0; i < 13; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthOptions.push({ month: d.getMonth(), year: d.getFullYear() });
        }

        const insights = aiService.generateInsights(
          expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
          }),
          budgets
        );

        return (
          <div className="dashboard-container">

            {/* Month Selector Bar */}
            <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderRadius: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Viewing:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <button
                  id="dashboard-month-prev"
                  onClick={() => {
                    const d = new Date(selectedYear, selectedMonth - 1, 1);
                    setSelectedMonth(d.getMonth());
                    setSelectedYear(d.getFullYear());
                  }}
                  style={{ background: 'var(--card-border)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Previous month"
                >‹</button>

                <select
                  id="dashboard-month-select"
                  value={`${selectedYear}-${selectedMonth}`}
                  onChange={e => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    setSelectedYear(y);
                    setSelectedMonth(m);
                  }}
                  style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '6px 12px', background: 'var(--card-bg)', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', cursor: 'pointer', flex: 1, maxWidth: '200px' }}
                >
                  {monthOptions.map(({ month, year }) => (
                    <option key={`${year}-${month}`} value={`${year}-${month}`}>
                      {MONTH_NAMES[month]} {year}
                    </option>
                  ))}
                </select>

                <button
                  id="dashboard-month-next"
                  onClick={() => {
                    if (isCurrentMonth) return;
                    const d = new Date(selectedYear, selectedMonth + 1, 1);
                    setSelectedMonth(d.getMonth());
                    setSelectedYear(d.getFullYear());
                  }}
                  style={{ background: 'var(--card-border)', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: isCurrentMonth ? 'not-allowed' : 'pointer', fontSize: '16px', color: isCurrentMonth ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isCurrentMonth ? 0.4 : 1 }}
                  title="Next month"
                  disabled={isCurrentMonth}
                >›</button>
              </div>
              {!isCurrentMonth && (
                <button
                  id="dashboard-month-today"
                  onClick={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); }}
                  style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '20px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', background: 'transparent', cursor: 'pointer', fontWeight: '700' }}
                >Back to Today</button>
              )}
            </div>

            {/* 1. Main Spending Card */}
            <StatCards expenses={expenses} budgets={budgets} savings={savings} selectedMonth={selectedMonth} selectedYear={selectedYear} />

            {/* 2. Financial Health Score Widget */}
            <FinancialHealthCard 
              healthData={financialHealth} 
              loading={healthLoading} 
              error={healthError} 
              onOpenDetails={() => setIsHealthModalOpen(true)} 
            />

            {/* Spending Analytics Charts */}
            <AnalyticsCharts expenses={expenses} selectedMonth={selectedMonth} selectedYear={selectedYear} />

            {/* 2. One-line AI Insight Card */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--card-bg)' }}>
              <div style={{ fontSize: '28px' }}>🤖</div>
              <div>
                <h4 style={{ margin: 0, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>AI Smart Advice</h4>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                  {insights.summary}
                </p>
              </div>
            </div>

            {/* Dynamic Alert Banner */}
            {notifications.length > 0 && isCurrentMonth && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.map((note, idx) => (
                  <div key={idx} className="alert-pill danger" style={{ fontSize: '13px', padding: '12px 16px', borderRadius: '12px', background: 'var(--danger-bg)', color: 'var(--danger)', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Financial Goals Section */}
            <FinancialGoals 
              goals={goals} 
              onAddGoal={() => { setEditingGoal(null); setIsGoalFormOpen(true); }}
              onUpdateGoal={handleUpdateGoalStatus}
              onDeleteGoal={handleDeleteGoal}
              onAddGoalSavings={(goal) => { setSelectedGoalForSavings(goal); setIsAddGoalSavingsOpen(true); }}
              loading={goalsLoading}
            />

            {/* Quick Strategy Tips */}
            <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-primary)' }} />
                <span>Quick Advice! 💡</span>
              </h3>
              <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {insights.tips.map((tip, idx) => (
                  <li key={idx} style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: tip.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                ))}
              </ul>
            </div>

          </div>
        );
      }
      case 'health':
        return (
          <FinancialHealthCard 
            healthData={financialHealth} 
            loading={healthLoading} 
            error={healthError} 
            onOpenDetails={() => setIsHealthModalOpen(true)} 
          />
        );
      case 'notifications':
        return <NotificationsPage onNavigateTab={setActiveTab} />;
      case 'admin-notifications':
        return <AdminNotifications />;
      case 'admin-analytics':
        return <AdminAnalytics />;
      case 'expenses':
        return (
          <>
            <ExpenseFilters filters={filters} setFilters={setFilters} />
            <ExpenseTable 
              expenses={expenses} 
              filters={filters} 
              setFilters={setFilters} 
              onEditExpense={openEditModal} 
              onDeleteExpense={handleDeleteExpense} 
              onClearAllExpenses={handleClearAllExpenses}
            />
          </>
        );
      case 'savings':
        return (
          <SavingTable 
            savings={savings} 
            onDeleteSaving={handleDeleteSaving} 
            onClearAllSavings={handleClearAllSavings}
          />
        );
      case 'budgeting':
        return (
          <BudgetLimits 
            budgets={budgets} 
            expenses={expenses} 
            onSaveBudgets={handleSaveBudgets} 
            onClearAllExpenses={handleClearAllExpenses}
          />
        );
      case 'insights':
        return (
          <InsightsPanel 
            expenses={expenses} 
            budgets={budgets} 
            savings={savings}
            currencyCode={currencyCode} 
          />
        );
      case 'achievements':
        return (
          <AchievementsList 
            achievementsData={achievementsData}
            loading={achievementsLoading}
          />
        );
      case 'trash':
        return (
          <RecentlyDeleted 
            trash={trash}
            onRestore={handleRestoreItem}
            onPermanentDelete={handlePermanentDeleteItem}
            onClearTrash={handleClearTrash}
          />
        );
      case 'feedback':
        return <FeedbackForm />;
      default:
        return <div>Tab not found</div>;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Financial Dashboard';
      case 'health': return 'Financial Health Score';
      case 'notifications': return 'User Notifications';
      case 'admin-notifications': return 'Admin Notifications & Alerts';
      case 'admin-analytics': return 'Weekly Admin Analytics Report';
      case 'expenses': return 'Expense Management';
      case 'savings': return 'Savings Log';
      case 'achievements': return 'Milestones & Achievements';
      case 'budgeting': return 'Budget Settings';
      case 'insights': return 'AI Smart Insights';
      case 'trash': return 'Recently Deleted';
      case 'feedback': return 'User Feedback';
      default: return 'Expense Tracker';
    }
  };

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'dashboard': return `Welcome back, ${user.name}! Here is your current month status.`;
      case 'health': return 'Backend-evaluated 5-component financial wellness score and trends.';
      case 'notifications': return 'Real-time alerts for budget limits, goal milestones, and system updates.';
      case 'admin-notifications': return 'Monitor system anomalies, registration events, and Make.com webhooks.';
      case 'admin-analytics': return 'Backend-aggregated weekly KPI metrics and Monday email dispatches.';
      case 'expenses': return 'Search, filter, edit, and export your expense records.';
      case 'savings': return 'Keep your backup money safe and track your deposits.';
      case 'achievements': return 'Track your streaks, milestones, and unlock special badges.';
      case 'budgeting': return 'Configure your monthly budget limits and alerts.';
      case 'insights': return 'Review natural language breakdowns and savings suggestions.';
      case 'trash': return 'Recover deleted expenses and savings within 30 days.';
      case 'feedback': return 'Tell us what you think or report bugs to spendachu@gmail.com.';
      default: return '';
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <div className="mobile-header">
        <button className="mobile-nav-toggle" onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}>
          {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.jpg" alt="Logo" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: '900', fontFamily: 'var(--font-heading)' }}>SpendAchu</span>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '4px 8px', background: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </div>

      {/* Main sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setMobileSidebarOpen(false);
        }} 
        user={user} 
        onLogout={handleLogout} 
        theme={theme}
        toggleTheme={toggleTheme}
        collapsed={sidebarCollapsed}
        setCollapsed={setCollapsed => setSidebarCollapsed(setCollapsed)}
        mobileOpen={mobileSidebarOpen}
      />

      {/* Main Workspace Frame */}
      <main className="main-content" style={{ position: 'relative' }}>
        <div className="header-bar">
          <div className="header-title-container">
            <h1>{getPageTitle()}</h1>
            <p>{getPageSubtitle()}</p>
          </div>
          
          <div className="header-actions">
            {/* User Notification Center Bell & Dropdown */}
            <NotificationCenter onNavigateTab={setActiveTab} />
            
            {/* Toggle light/dark */}
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle screen theme" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 10px', background: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)', fontWeight: 'bold', cursor: 'pointer' }}>
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>
        </div>

        {/* Tab body content */}
        <div className="tab-content-wrapper">
          {renderTabContent()}
        </div>

        {/* Floating Modal for Add/Edit Expense */}
        {isExpenseModalOpen && (
          <ExpenseForm 
            expense={editingExpense} 
            onClose={() => setIsExpenseModalOpen(false)} 
            onSave={handleSaveExpense} 
          />
        )}

        {/* Floating Modal for Add Saving */}
        {isSavingModalOpen && (
          <SavingForm 
            onClose={() => setIsSavingModalOpen(false)} 
            onSave={handleSaveSaving} 
          />
        )}

        {/* Hidden File Input for scanning */}
        <input
          ref={fileInputRef}
          type="file"
          id="receipt-file-input"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleReceiptScan}
        />

        {/* ── Duplicate Expense Warning Popup ── */}
        {duplicateWarning && (
          <DuplicateWarning
            confidence={duplicateWarning.confidence}
            existing={duplicateWarning.existing}
            onCancel={handleDuplicateCancel}
            onAddAnyway={handleDuplicateAddAnyway}
            onViewExisting={handleDuplicateViewExisting}
          />
        )}

        {/* ── Camera Capture Preview Overlay ── */}
        {capturePreviewUrl && (
          <div
            className="modal-overlay"
            style={{ zIndex: 11500 }}
            role="dialog"
            aria-modal="true"
            aria-label="Receipt capture preview"
          >
            <div
              className="glass-card"
              style={{
                width: '95%',
                maxWidth: '480px',
                borderRadius: '24px',
                border: '1px solid var(--card-border)',
                boxShadow: 'var(--shadow-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Receipt Captured 📸</span>
                  <h2 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '900', color: 'var(--text-primary)' }}>Looks good?</h2>
                </div>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(capturePreviewUrl);
                    setCapturePreviewUrl(null);
                    setCapturedFile(null);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px' }}
                  title="Cancel"
                  aria-label="Cancel capture"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Image Preview */}
              <div
                style={{
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '2px solid var(--card-border)',
                  background: 'var(--bg-secondary)',
                  maxHeight: '55vh',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={capturePreviewUrl}
                  alt="Captured receipt"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    maxHeight: '55vh'
                  }}
                />
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.5' }}>
                Make sure the receipt is sharp and fully visible before scanning.
              </p>

              {/* Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  id="capture-retake-btn"
                  type="button"
                  onClick={handleRetake}
                  className="outline-btn"
                  style={{ justifyContent: 'center', padding: '13px', borderRadius: '14px', fontSize: '14px', fontWeight: '700' }}
                >
                  <Camera size={16} />
                  <span>Retake</span>
                </button>
                <button
                  id="capture-continue-btn"
                  type="button"
                  onClick={handleContinueToOCR}
                  className="glow-btn"
                  style={{ justifyContent: 'center', padding: '13px', borderRadius: '14px', fontSize: '14px', fontWeight: '700' }}
                >
                  <Sparkles size={16} />
                  <span>Scan with AI</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Preview Screen */}
        {isReceiptPreviewOpen && scanResult && (
          <ReceiptPreview 
            result={scanResult}
            onSave={handleSaveScannedExpense}
            onScanAgain={() => {
              setIsReceiptPreviewOpen(false);
              triggerFileSelect();
            }}
            onCancel={() => {
              setIsReceiptPreviewOpen(false);
              setScanResult(null);
            }}
          />
        )}

        {/* Scanning Receipt Loader Overlay */}
        {isScanning && (
          <div className="modal-overlay scanning-overlay" style={{ zIndex: 12000 }}>
            <div className="glass-card scanning-card" style={{ padding: '30px', borderRadius: '20px', textAlign: 'center', maxWidth: '400px', width: '90%', border: '1px solid var(--card-border)', boxShadow: 'var(--shadow-lg)' }}>
              <div className="scanning-spinner" style={{
                width: '50px',
                height: '50px',
                border: '4px solid var(--card-border)',
                borderTop: '4px solid var(--accent-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 20px auto'
              }}></div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '10px' }}>Scanning Receipt with AI...</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Achu is analyzing the receipt content. Please wait a moment.
              </p>
            </div>
          </div>
        )}

        {/* Desktop Floating Buttons (hidden on mobile via CSS) */}
        <button 
          className="glow-btn floating-action-btn saving desktop-only-fab" 
          onClick={() => setIsSavingModalOpen(true)}
          title="Add Saving"
        >
          <Plus size={20} />
          <span>Add Saving 💰</span>
        </button>

        <button 
          className="glow-btn floating-action-btn spending desktop-only-fab" 
          onClick={openAddModal}
          title="Add Expense"
        >
          <Plus size={20} />
          <span>Add Spending 💸</span>
        </button>

        <button 
          className="glow-btn floating-action-btn scanner desktop-only-fab" 
          onClick={triggerFileSelect}
          title="Scan Receipt with AI"
        >
          <Camera size={20} />
          <span>Scan Receipt 📸</span>
        </button>

        {/* Mobile Bottom Action Bar (visible only on mobile via CSS) */}
        <div className="mobile-action-bar">
          <button 
            className="glow-btn floating-action-btn saving" 
            onClick={() => setIsSavingModalOpen(true)}
          >
            <Plus size={18} />
            <span>Save 💰</span>
          </button>
          <button 
            className="glow-btn floating-action-btn spending" 
            onClick={openAddModal}
          >
            <Plus size={18} />
            <span>Spend 💸</span>
          </button>
          <button 
            className="glow-btn floating-action-btn scanner" 
            onClick={triggerFileSelect}
          >
            <Camera size={18} />
            <span>Scan 📸</span>
          </button>
        </div>

        {/* Logout Confirmation Modal */}
        {showLogoutConfirm && (
          <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
          }}>
            <div className="glass-card" style={{
              width: '90%',
              maxWidth: '400px',
              padding: '30px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-md)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-color)',
              textAlign: 'center'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Log Out</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Are you sure you want to log out of SpendAchu?
              </p>
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                <button 
                  className="outline-btn" 
                  style={{ padding: '10px 20px', minWidth: '110px', justifyContent: 'center' }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="glow-btn" 
                  style={{ padding: '10px 20px', minWidth: '110px', justifyContent: 'center', backgroundColor: '#f87171', borderColor: 'var(--border-color)' }}
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    performLogout();
                  }}
                >
                  Log Out
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Goal Creation/Edit Modal */}
        {isGoalFormOpen && (
          <GoalForm
            goal={editingGoal}
            onClose={() => { setIsGoalFormOpen(false); setEditingGoal(null); }}
            onSave={handleSaveGoal}
          />
        )}

        {/* Deposit savings to Goal Modal */}
        {isAddGoalSavingsOpen && selectedGoalForSavings && (
          <AddGoalSavingsModal
            goal={selectedGoalForSavings}
            onClose={() => { setIsAddGoalSavingsOpen(false); setSelectedGoalForSavings(null); }}
            onSave={handleDepositGoalSavings}
          />
        )}

        {/* Goal Achievement Celebration Modal */}
        {completedGoalCelebration && (
          <GoalCompletedModal
            goal={completedGoalCelebration}
            onClose={() => setCompletedGoalCelebration(null)}
          />
        )}

        {/* Achievement Unlock Congratulations Modal */}
        {unlockedAchievementsQueue.length > 0 && (
          <AchievementUnlockModal
            achievements={unlockedAchievementsQueue}
            onClose={handleDismissUnlockModal}
          />
        )}

        {/* Financial Health Detailed Breakdown Modal */}
        {isHealthModalOpen && (
          <FinancialHealthModal
            healthData={financialHealth}
            onClose={() => setIsHealthModalOpen(false)}
          />
        )}
      </main>
    </div>
  );
}
