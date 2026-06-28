import React, { useState, useEffect } from 'react';
import { Plus, Menu, X, Bell, Sparkles } from 'lucide-react';

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
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  
  // 3. UI control states
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSavingModalOpen, setIsSavingModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]); // Dynamic budget alerts

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

  const handleLoginSuccess = async (loggedInUser) => {
    setUser(loggedInUser);
    
    try {
      // Fetch user-isolated financial data
      const [records, limits, savingsList, trashList] = await Promise.all([
        dbService.getExpenses(),
        dbService.getBudgets(),
        dbService.getSavings(),
        dbService.getTrash()
      ]);
      
      setExpenses(records);
      setBudgets(limits);
      setSavings(savingsList);
      setTrash(trashList);

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
  };

  const handleSaveExpense = async (payload) => {
    try {
      if (editingExpense && editingExpense.id) {
        // Update action
        await dbService.updateExpense(editingExpense.id, payload);
      } else {
        // Add action
        await dbService.addExpense(payload);
      }
      
      // Reload database states
      const updatedExpenses = await dbService.getExpenses();
      setExpenses(updatedExpenses);
      setIsExpenseModalOpen(false);
      setEditingExpense(null);

      // Trigger instant check for budget warnings
      checkBudgetAlerts(updatedExpenses, budgets);
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

      // Trigger instant check for budget warnings
      checkBudgetAlerts(updatedExpenses, budgets);
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
      await dbService.addSaving(payload);
      const updatedSavings = await dbService.getSavings();
      setSavings(updatedSavings);
      setIsSavingModalOpen(false);
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
      case 'expenses': return 'Expense Management';
      case 'savings': return 'Savings Log';
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
      case 'expenses': return 'Search, filter, edit, and export your expense records.';
      case 'savings': return 'Keep your backup money safe and track your deposits.';
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
            {/* Quick Alert Bell */}
            {notifications.length > 0 && (
              <div 
                style={{ position: 'relative', cursor: 'pointer', color: 'var(--danger)', padding: '8px', background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }} 
                title="Active budget warning alerts"
                onClick={() => setActiveTab('insights')}
              >
                <Bell size={18} style={{ padding: 0 }} />
              </div>
            )}
            
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


        {/* Large Floating Add Saving Button */}
        <button 
          className="glow-btn floating-action-btn saving" 
          onClick={() => setIsSavingModalOpen(true)}
          title="Add Saving"
        >
          <Plus size={20} />
          <span className="desktop-text">Add Saving 💰</span>
          <span className="mobile-text">Save 💰</span>
        </button>

        {/* Large Floating Add Expense Button */}
        <button 
          className="glow-btn floating-action-btn spending" 
          onClick={openAddModal}
          title="Add Expense"
        >
          <Plus size={20} />
          <span className="desktop-text">Sema Spending! 💸</span>
          <span className="mobile-text">Spend 💸</span>
        </button>

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
      </main>
    </div>
  );
}
