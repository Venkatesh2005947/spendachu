import React from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { formatCurrency } from '../../utils/helpers';

// Category color mappings matching CSS classes
const COLORS = {
  Food: '#d97706',
  Transport: '#2563eb',
  Rent: '#7c3aed',
  Shopping: '#db2777',
  Bills: '#059669',
  Entertainment: '#0891b2'
};

export default function AnalyticsCharts({ expenses }) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter expenses for current month
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  // 1. Process Data for Daily Spend Line/Area Chart
  const getDailyData = () => {
    // Create an array of days in current month up to today
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const limit = now.getDate(); // limit to current day for better aesthetics
    
    const dailyMap = {};
    for (let i = 1; i <= daysInMonth; i++) {
      dailyMap[i] = 0;
    }

    // Populate actual spending
    thisMonthExpenses.forEach(e => {
      const day = new Date(e.date + 'T00:00:00').getDate();
      if (dailyMap[day] !== undefined) {
        dailyMap[day] += e.amount;
      }
    });

    // Compile cumulative data
    let cumulativeSum = 0;
    const data = [];
    // We can show up to current day of month, or all days. Let's show up to daysInMonth but highlight only up to today's cumulative velocity
    for (let i = 1; i <= daysInMonth; i++) {
      cumulativeSum += dailyMap[i];
      const monthLabel = now.toLocaleString('default', { month: 'short' });
      data.push({
        day: `${monthLabel} ${i < 10 ? '0' + i : i}`,
        Daily: dailyMap[i],
        Cumulative: parseFloat(cumulativeSum.toFixed(2))
      });
    }
    return data;
  };

  // 2. Process Data for Category Distribution Pie Chart
  const getCategoryData = () => {
    const catMap = {};
    thisMonthExpenses.forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });

    return Object.entries(catMap).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    }));
  };

  const dailyData = getDailyData();
  const categoryData = getCategoryData();

  // Custom tooltips
  const CustomAreaTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--card-border)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>{payload[0].payload.day}</p>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
            Daily: {formatCurrency(payload[0].payload.Daily)}
          </p>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--success)' }}>
            Cumulative: {formatCurrency(payload[0].payload.Cumulative)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--card-border)',
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <p style={{ fontSize: '13px', fontWeight: 'bold', color: payload[0].payload.color || 'var(--text-primary)' }}>
            {payload[0].name}: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="charts-section">
      {/* Daily cumulative spending area chart */}
      <div className="glass-card chart-card">
        <div className="chart-title">
          <h3>Spending Velocity (Cumulative)</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Current Month</span>
        </div>
        <div className="chart-container-inner">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
              <XAxis 
                dataKey="day" 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                interval={Math.ceil(dailyData.length / 6)}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area 
                type="monotone" 
                dataKey="Cumulative" 
                stroke="var(--accent-primary)" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#spendGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown pie chart */}
      <div className="glass-card chart-card" style={{ height: '360px' }}>
        <div className="chart-title">
          <h3>Category Distribution</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>This Month</span>
        </div>
        <div className="chart-container-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {categoryData.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No spending data for this category map</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[entry.name] || '#6b7280'} 
                      color={COLORS[entry.name] || '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconSize={10}
                  iconType="circle"
                  wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// Hardcoded for INR Indian Usage
