import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Tag, Calendar, DollarSign, FileText } from 'lucide-react';
import { useDialog } from '@/hooks/useDialog';
import Button from '@/components/ui/Button';
import { useUIStore } from '@/stores/uiStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { toast } from '@/components/ui/Toast';
import { EXPENSE_CATEGORIES } from '@/utils/expenseCategories';
import { todayISO } from '@/utils/formatDate';
import type { Expense, ExpenseCategory } from '@/types';

// ── Shared field styles ───────────────────────────────────────────────────

const fieldLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 11, fontWeight: 600, color: 'var(--text-sub)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

const fieldControl: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-default)', borderRadius: 8,
  padding: '8px 10px', fontSize: 13, outline: 'none', cursor: 'pointer',
};

// ── Component ─────────────────────────────────────────────────────────────
// Used for both "add" and "edit" — pass `expense` to edit an existing record.

interface ExpenseFormOverlayProps {
  expense?: Expense;
}

export default function ExpenseFormOverlay({ expense }: ExpenseFormOverlayProps) {
  const isEditMode = Boolean(expense);

  const closeAddExpense  = useUIStore((s) => s.closeAddExpense);
  const closeEditExpense = useUIStore((s) => s.closeEditExpense);
  const addExpense       = useExpenseStore((s) => s.addExpense);
  const updateExpense    = useExpenseStore((s) => s.updateExpense);
  const currency         = useSettingsStore((s) => s.currency);

  const close = isEditMode ? closeEditExpense : closeAddExpense;

  const [title, setTitle]                   = useState(expense?.title ?? '');
  const [description, setDescription]       = useState(expense?.description ?? '');
  const [amount, setAmount]                 = useState(expense ? String(expense.amount) : '');
  const [category, setCategory]             = useState<ExpenseCategory>(expense?.category ?? 'grocery');
  const [customCategory, setCustomCategory] = useState(expense?.customCategory ?? '');
  const [date, setDate]                     = useState(expense?.date ?? todayISO());
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [formError, setFormError] = useState('');
  useDialog(panelRef);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [close]);

  // "@" autocomplete: active when the word before the caret is "@partial"
  const [caret, setCaret] = useState(0);
  const [hi, setHi] = useState(0);
  const [acDismissed, setAcDismissed] = useState(false);
  const atMatch = /(?:^|\s)@(\w*)$/.exec(title.slice(0, caret));
  const suggestions = atMatch && !acDismissed
    ? EXPENSE_CATEGORIES.filter((c) => c.value.startsWith(atMatch[1].toLowerCase()))
    : [];
  const acOpen = suggestions.length > 0;

  // Picking removes the "@token" from the title and sets the category field
  const pickCategory = (value: ExpenseCategory) => {
    const before = title.slice(0, caret).replace(/@\w*$/, '');
    setTitle(before + title.slice(caret));
    setCategory(value);
    setCaret(before.length);
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(before.length, before.length));
  };

  const amountValue = parseFloat(amount);
  const isValid =
    title.trim().length > 0 &&
    !Number.isNaN(amountValue) && amountValue > 0 &&
    (category !== 'other' || customCategory.trim().length > 0);

  const handleSubmit = useCallback(async () => {
    if (!isValid) {
      setFormError(!title.trim() ? 'Enter a title.' : !(amountValue > 0) ? 'Enter an amount greater than 0.' : 'Enter a custom category name.');
      if (!title.trim()) inputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    try {
      // A fully typed "@grocery" that wasn't picked from the list still counts
      const typed = /(?:^|\s)@(\w+)(?=\s|$)/.exec(title);
      const typedCat = EXPENSE_CATEGORIES.find((c) => c.value === typed?.[1].toLowerCase())?.value;
      const finalTitle = typedCat ? title.replace(typed![0], ' ').replace(/\s+/g, ' ').trim() : title.trim();
      const finalCategory = typedCat ?? category;
      if (!finalTitle || (finalCategory === 'other' && !customCategory.trim())) {
        setFormError(!finalTitle ? 'Enter a title.' : 'Enter a custom category name.');
        return;
      }
      const payload = {
        title: finalTitle,
        description: description.trim() || undefined,
        amount: amountValue,
        category: finalCategory,
        customCategory: finalCategory === 'other' ? customCategory.trim() : undefined,
        date,
      };

      if (isEditMode && expense) {
        await updateExpense(expense.id, payload);
        toast.success('Expense updated');
      } else {
        await addExpense(payload);
        toast.success('Expense added');
      }
      close();
    } catch {
      toast.error('Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  }, [isValid, title, description, amountValue, category, customCategory, date,
      isEditMode, expense, addExpense, updateExpense, close]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSubmit]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, background: 'var(--bg-overlay)',
      }}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Expense" style={{
        width: '100%', maxWidth: 480,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            {isEditMode ? 'Edit Expense' : 'New Expense'}
          </span>
          <Button variant="ghost" iconOnly size="sm" onClick={close} title="Close">
            <X size={15} />
          </Button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px 20px 16px' }}>

          {/* Title */}
          <div style={{ position: 'relative' }}>
          <input
            aria-label="Expense title" aria-invalid={!!formError} aria-describedby={formError ? 'form-error' : undefined}
            role="combobox" aria-expanded={acOpen} aria-controls="category-suggestions" aria-autocomplete="list"
            ref={inputRef}
            value={title}
            onChange={(e) => {
              setFormError(''); setAcDismissed(false); setHi(0);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setTitle(e.target.value);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
            onKeyDown={(e) => {
              if (acOpen) {
                if (e.key === 'ArrowDown') { e.preventDefault(); setHi((hi + 1) % suggestions.length); return; }
                if (e.key === 'ArrowUp')   { e.preventDefault(); setHi((hi - 1 + suggestions.length) % suggestions.length); return; }
                if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickCategory(suggestions[hi % suggestions.length].value); return; }
                if (e.key === 'Escape')    { e.stopPropagation(); setAcDismissed(true); return; }
              }
              if (e.key === 'Enter' && !e.shiftKey) handleSubmit();
            }}
            placeholder="Expense title — e.g. Weekly run @grocery"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, fontWeight: 500,
              color: 'var(--text-primary)', caretColor: 'var(--accent)',
              padding: '0 0 12px 0',
              borderBottom: '1px solid var(--border-default)',
              marginBottom: 14,
            }}
          />
          {acOpen && (
            <ul id="category-suggestions" role="listbox" style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 10, margin: '-8px 0 0', padding: 4,
              listStyle: 'none', minWidth: 200,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}>
              {suggestions.map((c, i) => (
                <li
                  key={c.value} role="option" aria-selected={i === hi % suggestions.length}
                  onMouseDown={(e) => { e.preventDefault(); pickCategory(c.value); }}
                  onMouseEnter={() => setHi(i)}
                  style={{
                    padding: '6px 10px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                    color: 'var(--text-primary)',
                    background: i === hi % suggestions.length ? 'var(--bg-chip)' : 'transparent',
                  }}
                >{c.emoji} {c.label}</li>
              ))}
            </ul>
          )}
          </div>
          {formError && (
            <p id="form-error" role="alert" style={{ margin: '-6px 0 12px', fontSize: 12, color: 'var(--error, #dc2626)' }}>
              {formError}
            </p>
          )}

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-default)', borderRadius: 8,
              padding: '8px 10px', fontSize: 13, outline: 'none',
              fontFamily: 'inherit', marginBottom: 18,
            }}
          />

          {/* Field grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 14px' }}>

            {/* Amount */}
            <label>
              <div style={fieldLabel}><DollarSign size={11} /> Amount ({currency})</div>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => { setFormError(''); setAmount(e.target.value); }}
                placeholder="0.00"
                style={{ ...fieldControl, cursor: 'text' }}
              />
            </label>

            {/* Date */}
            <label>
              <div style={fieldLabel}><Calendar size={11} /> Date</div>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={{ ...fieldControl, colorScheme: 'dark' }} />
            </label>

            {/* Category */}
            <label style={{ gridColumn: category === 'other' ? 'span 1' : 'span 2' }}>
              <div style={fieldLabel}><Tag size={11} /> Category</div>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} style={fieldControl}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </label>

            {/* Custom category name — only when "Other" is selected */}
            {category === 'other' && (
              <label>
                <div style={fieldLabel}><FileText size={11} /> Custom name</div>
                <input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  style={{ ...fieldControl, cursor: 'text' }}
                />
              </label>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-elevated)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-placeholder)' }}>
            Press{' '}
            <kbd style={{
              background: 'var(--bg-chip)', color: 'var(--text-sub)',
              padding: '1px 6px', borderRadius: 4, fontSize: 11,
            }}>⌘ Enter</kbd>
            {' '}to save
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Expense'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
