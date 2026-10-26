import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import { useExpenseStore } from '@/stores/expenseStore';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import ExpenseDaySection from '@/components/expense/ExpenseDaySection';
import ExpenseList from '@/components/expense/ExpenseList';
import EmptyState from '@/components/ui/EmptyState';
import { EmptyIllustration } from '@/components/ui/EmptyIllustration';
import { Section, StatCard, BarRow, InsightCard } from '@/components/ui/StatPrimitives';
import { card } from '@/components/ui/statStyles';
import { formatCurrency } from '@/utils/formatCurrency';
import { EXPENSE_CATEGORY_META } from '@/utils/expenseCategories';
import type { Expense } from '@/types';

// ── Date helpers ──────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function sectionLabel(dateStr: string): { label: string; sublabel: string } {
  const full = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  if (dateStr === todayStr())     return { label: 'Today',     sublabel: full };
  if (dateStr === yesterdayStr()) return { label: 'Yesterday', sublabel: full };

  const weekday = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' });
  return { label: weekday, sublabel: full };
}

function groupByDate(expenses: Expense[]): Map<string, Expense[]> {
  const map = new Map<string, Expense[]>();
  for (const e of expenses) {
    if (!map.has(e.date)) map.set(e.date, []);
    map.get(e.date)!.push(e);
  }
  return map;
}

function monthLabel(ym: string): string {
  return new Date(ym + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function categoryTotalsFor(list: Expense[]) {
  const map = new Map<string, { label: string; emoji: string; amount: number }>();
  for (const e of list) {
    const meta  = EXPENSE_CATEGORY_META[e.category];
    const label = e.category === 'other' ? (e.customCategory?.trim() || 'Other') : meta.label;
    const existing = map.get(label);
    if (existing) existing.amount += e.amount;
    else map.set(label, { label, emoji: meta.emoji, amount: e.amount });
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ExpensesView() {
  const { expenses, isLoading, loadAll } = useExpenseStore();
  const openAddExpense = useUIStore((s) => s.openAddExpense);
  const currency        = useSettingsStore((s) => s.currency);

  useEffect(() => { loadAll(); }, [loadAll]);

  const currentMonth = todayStr().slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth); // YYYY-MM or 'all'

  // Months that have data (plus the current one), newest first
  const months = useMemo(() => {
    const set = new Set<string>([currentMonth]);
    for (const e of expenses) set.add(e.date.slice(0, 7));
    return [...set].sort().reverse();
  }, [expenses, currentMonth]);

  const isAll = selectedMonth === 'all';

  const scopedExpenses = useMemo(
    () => (isAll ? expenses : expenses.filter((e) => e.date.startsWith(selectedMonth))),
    [expenses, selectedMonth, isAll]
  );

  const totalScoped = useMemo(
    () => scopedExpenses.reduce((sum, e) => sum + e.amount, 0),
    [scopedExpenses]
  );

  const totalToday = useMemo(
    () => expenses.filter((e) => e.date === todayStr()).reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );

  const categoryTotals = useMemo(() => categoryTotalsFor(scopedExpenses), [scopedExpenses]);

  // Month-by-month: total + category split for every month with data
  const monthlyBreakdown = useMemo(() => {
    const byMonth = new Map<string, Expense[]>();
    for (const e of expenses) {
      const m = e.date.slice(0, 7);
      if (!byMonth.has(m)) byMonth.set(m, []);
      byMonth.get(m)!.push(e);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, list]) => ({
        month,
        total: list.reduce((s, e) => s + e.amount, 0),
        categories: categoryTotalsFor(list),
      }));
  }, [expenses]);

  const topCategory = categoryTotals[0];
  // Average per day: days elapsed for the current month, full length for past months, active days for all-time
  const avgPerDay = useMemo(() => {
    if (isAll) {
      const days = new Set(scopedExpenses.map((e) => e.date)).size;
      return days ? totalScoped / days : 0;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const days = selectedMonth === currentMonth ? new Date().getDate() : new Date(y, m, 0).getDate();
    return totalScoped / days;
  }, [isAll, scopedExpenses, totalScoped, selectedMonth, currentMonth]);

  const scopeLabel = isAll ? 'all time' : monthLabel(selectedMonth);

  const grouped = useMemo(() => groupByDate(expenses), [expenses]);
  const sortedDates = useMemo(() => [...grouped.keys()].sort().reverse(), [grouped]);

  // No expenses at all — full-width centered empty state
  if (!isLoading && expenses.length === 0) {
    return (
      <EmptyState
        icon={<EmptyIllustration variant="wallet" />}
        title="No expenses yet"
        subtitle="Track your spending by adding your first expense."
        action={
          <Button variant="primary" onClick={openAddExpense}>+ Add Expense</Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Period selector */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          aria-label="Select month"
          style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 14,
            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
            border: '1px solid var(--border-default)',
          }}
        >
          <option value="all">All time</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Overview */}
      <Section title="Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard value={formatCurrency(totalScoped, currency)} label={`Spent (${scopeLabel})`} />
          <StatCard value={formatCurrency(totalToday, currency)} label="Spent today" color="var(--accent)" />
          <StatCard value={scopedExpenses.length} label={`Transactions (${scopeLabel})`} />
        </div>
      </Section>

      {/* By Category (selected period) */}
      {categoryTotals.length > 0 && (
        <Section title={`By Category · ${scopeLabel}`}>
          <div style={{ ...card, padding: '18px 20px' }}>
            {categoryTotals.map((c) => (
              <BarRow
                key={c.label}
                label={`${c.emoji} ${c.label}`}
                count={c.amount}
                total={totalScoped}
                color="var(--accent)"
                valueLabel={formatCurrency(c.amount, currency)}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Month by month, category-wise */}
      {monthlyBreakdown.length > 0 && (
        <Section title="Month by Month">
          {monthlyBreakdown.map((m) => (
            <div key={m.month} style={{ ...card, padding: '18px 20px', marginBottom: 12 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: 12,
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              }}>
                <span>{monthLabel(m.month)}</span>
                <span>{formatCurrency(m.total, currency)}</span>
              </div>
              {m.categories.map((c) => (
                <BarRow
                  key={c.label}
                  label={`${c.emoji} ${c.label}`}
                  count={c.amount}
                  total={m.total}
                  color="var(--accent)"
                  valueLabel={formatCurrency(c.amount, currency)}
                />
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Insights */}
      <Section title="Insights">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <InsightCard
            emoji={topCategory?.emoji ?? '🏆'}
            value={topCategory ? formatCurrency(topCategory.amount, currency) : '—'}
            label={topCategory ? `Top category: ${topCategory.label}` : 'No spending yet'}
          />
          <InsightCard
            emoji="📈"
            value={formatCurrency(avgPerDay, currency)}
            label={isAll ? 'Avg. per active day' : 'Avg. per day'}
          />
        </div>
      </Section>

      {/* Expense list, grouped by date */}
      {isLoading ? (
        <ExpenseList expenses={[]} isLoading skeletonCount={5} />
      ) : (
        sortedDates.map((dateStr) => {
          const { label, sublabel } = sectionLabel(dateStr);
          return (
            <ExpenseDaySection
              key={dateStr}
              label={label}
              sublabel={sublabel}
              expenses={grouped.get(dateStr)!}
              defaultOpen
            />
          );
        })
      )}
    </div>
  );
}
