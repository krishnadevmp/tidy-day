# Tidy Day

A fast, offline-first PWA for tasks and expenses, built with React 19 and TypeScript. Features smart inline text parsing, recurring tasks, expense tracking, productivity stats, optional accounts with cross-device sync, and a native install experience on Android and iOS.

**Live:** [wonderful-tree-0fdeaa900.7.azurestaticapps.net](https://wonderful-tree-0fdeaa900.7.azurestaticapps.net)

> Formerly *Quick Todo*. The repo is now `tidy-day`; the backend service (`quick-todo-service`) and internal storage names (`QuickTodoDB`, `quick-todo-*` keys) keep the old name on purpose so existing local data isn't orphaned.

---

## Features

### Smart Quick-Add
Type a task and inline shortcuts are parsed automatically — no forms, no clicks:

```
Buy groceries due:tomorrow !high #errands @personal every:week
```

| Shortcut | Values | Effect |
|---|---|---|
| `!high` / `!h` | `high`, `medium` / `m`, `low` / `l` | Priority |
| `#tag` | any word | Adds a tag (repeatable) |
| `@category` | `work`, `personal`, `project`, `routine` | Category |
| `due:` | `today`, `tomorrow`, `mon`–`sun`, `YYYY-MM-DD` | Due date |
| `every:` | `day`, `weekdays`, `week`, `month` | Recurring pattern |

### Recurring Tasks
Tasks marked with `every:` auto-generate the next occurrence when completed. Completion is wrapped in an IndexedDB transaction with an idempotency guard so double-taps never create duplicates.

### Productivity Dashboard
- 7-day completion chart
- Streak counter and most productive day
- Priority and category breakdowns
- Completion rate and overdue count

### Expense Tracking
Log expenses with a title, amount, date and category (grocery, rent, electricity, water, phone, entertainment, equipment, or a custom "other" name). The Expenses view shows an overview, a month-by-month category breakdown with a month picker, and a day-grouped list. Currency (AED, USD, EUR, GBP, INR, SAR) is set in Settings; the default is AED.

### Accounts & Sync
- **Guest mode** ("Continue without an account") keeps everything on the device, with no network calls.
- **Signed-in accounts** use a local-first sync engine: writes always land in IndexedDB instantly, then a queued outbox is pushed to the API on write, on reconnect and every 2 minutes.
- Each identity has its own scoped IndexedDB (`QuickTodoDB` for guests, `QuickTodoDB__<userId>` for accounts). After signup or login you can import existing guest data into the account.
- Conflict handling is last-write-wins; there is no field-level merge.

### Accessibility
Form fields are labelled, modals are real dialogs (focus is trapped and restored, Esc closes), validation errors are announced inline, icon-only buttons have accessible names, and text colours target WCAG AA contrast. See [UX_AUDIT.md](UX_AUDIT.md) for the audit and remaining open items.

### Views
- **Today** — tasks due today with a progress bar
- **Upcoming** — future tasks in a timeline
- **All** — full task list with filter bar (priority, category, tags, search)
- **Dashboard** — productivity stats
- **Expenses** — spending overview, category breakdown, daily list
- **Settings** — theme, defaults, notifications, data export/import

### PWA
- Installable on Android (Chrome install prompt) and iOS (Web Share API → "Add to Home Screen")
- Works offline — data lives in IndexedDB via Dexie.js; the service worker (Workbox, auto-update) precaches the app shell
- Reminders use the browser Notification API, scheduled while the app is open (no server push)

---

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 19 + TypeScript |
| Build | Vite 8 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 + CSS variable theme tokens |
| State | Zustand 5 |
| Database | Dexie.js 4 (IndexedDB) |
| PWA | vite-plugin-pwa 1.3.0 + Workbox |
| Icons | lucide-react |
| Virtual list | @tanstack/react-virtual |
| E2E tests | Playwright |
| Backend | [quick-todo-service](../quick-todo-service) — Node, Express, Prisma, PostgreSQL |
| Deployment | Azure Static Web Apps |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# End-to-end tests (starts the dev server automatically)
npm run test:e2e
```

Requires Node.js 20.19+ or 22.12+ (a Vite 8 requirement).

### Configuration
Copy `.env.example` to `.env`. `VITE_API_URL` points at the backend API (default `http://localhost:4000/api`). Guest mode works without a backend; sign-in and sync need it running. In CI the value comes from the `VITE_API_URL` repository secret.

---

## Project Structure

```
src/
├── api/              # Fetch client + auth, tasks, expenses, settings endpoints
├── components/
│   ├── auth/         # AuthLayout, form fields, guest-import dialog
│   ├── expense/      # ExpenseCard, ExpenseList, ExpenseFormOverlay
│   ├── layout/       # Topbar, Sidebar, BottomNav, FAB, AddMenu, AvatarMenu
│   ├── pwa/          # InstallBanner (Android + iOS)
│   ├── quickadd/     # QuickAddOverlay + inline parser UI
│   ├── task/         # TaskCard, TaskList, EditTaskOverlay
│   ├── ui/           # Button, FilterBar, Toast, EmptyState, …
│   └── views/        # Today, Upcoming, All, Dashboard, Expenses, Settings
├── db/               # Dexie schema (scoped per identity) + task/expense repositories
├── hooks/            # useDialog, useInstallPrompt, useOnlineStatus, useLocalStorage, …
├── pages/            # LoginPage, SignupPage, AccountPage
├── routes/           # AppRoutes, RequireSession
├── stores/           # Zustand slices (task, expense, ui, settings, auth)
├── sync/             # Outbox, sync engine, guest-data import
├── types/            # Shared TypeScript types
└── utils/            # parseInput, recurringUtils, notificationScheduler, expense helpers
e2e/                  # Playwright specs
```

---

## Data Model

Tasks are stored in IndexedDB with the following shape:

```ts
interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high';
  category?: 'work' | 'personal' | 'project' | 'routine';
  tags: string[];
  description?: string;
  dueDate?: string;           // ISO date YYYY-MM-DD
  dueTime?: string;           // HH:MM, used for reminders
  recurring: 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
  recurringParentId?: string; // links occurrences back to root
  reminderOffset: 'none' | 'at' | '15' | '30' | '60' | '1440';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;             // in the currency chosen in Settings
  category: 'grocery' | 'rent' | 'electricity' | 'water' | 'phone'
          | 'entertainment' | 'equipment' | 'other';
  customCategory?: string;    // only when category === 'other'
  date: string;               // ISO date YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}
```

Export / import is available in Settings as a JSON file — useful for backups or migrating between devices.

---

## Deployment

The app is deployed to **Azure Static Web Apps** via GitHub Actions. Every push to `master` triggers a build and deploy (output: `dist`).

Configuration: [`.github/workflows/azure-static-web-apps-wonderful-tree-0fdeaa900.yml`](.github/workflows/azure-static-web-apps-wonderful-tree-0fdeaa900.yml)
