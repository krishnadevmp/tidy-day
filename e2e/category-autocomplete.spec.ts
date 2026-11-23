import { test, expect, type Page } from '@playwright/test';

// scoped to the autocomplete list (native <select> options also have role=option)
const OPT = '#category-suggestions [role=option]';

const openForm = async (page: Page, item: 'New Task' | 'New Expense') => {
  // App redirects fresh visitors to /signup; seed guest mode so the app shell loads
  await page.addInitScript(() => localStorage.setItem('quick-todo-auth',
    JSON.stringify({ state: { user: null, token: null, mode: 'guest', hasOnboarded: true }, version: 0 })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: item }).click();
};

test.describe('Quick-add task: @category autocomplete', () => {
  test.beforeEach(async ({ page }) => openForm(page, 'New Task'));
  const title = (page: Page) => page.getByLabel('Task title');

  test('"@" lists all categories, typing narrows the list', async ({ page }) => {
    await title(page).fill('Plan @');
    await expect(page.locator(OPT)).toHaveCount(4);
    await title(page).fill('Plan @pe');
    await expect(page.locator(OPT)).toHaveCount(1);
    await expect(page.locator(OPT).filter({ hasText: /Personal/ })).toBeVisible();
    await title(page).fill('Plan @zzz');
    await expect(page.locator(OPT)).toHaveCount(0);
  });

  test('keyboard pick (arrows + Enter) sets category and does not submit', async ({ page }) => {
    await title(page).fill('Plan @');
    await page.keyboard.press('ArrowDown'); // Personal
    await page.keyboard.press('Enter');
    await expect(title(page)).toHaveValue('Plan @personal ');
    await expect(page.getByLabel('Category')).toHaveValue('personal');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('mouse pick works, Escape closes only the list', async ({ page }) => {
    await title(page).fill('x @');
    await page.keyboard.press('Escape');
    await expect(page.locator(OPT)).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
    await title(page).fill('x @pro');
    await page.locator(OPT).filter({ hasText: /Project/ }).click();
    await expect(page.getByLabel('Category')).toHaveValue('project');
  });

  test('regression: tags, priority, plain Enter submit, email-like "@" ignored', async ({ page }) => {
    await title(page).fill('mail a@');
    await expect(page.locator(OPT)).toHaveCount(0); // "@" not preceded by whitespace
    await title(page).fill('Buy milk !high #groceries @work');
    await page.keyboard.press('Escape'); // dismiss list
    await title(page).press('Enter');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Buy milk', { exact: true })).toBeVisible();
  });

  test('empty title still shows the validation error', async ({ page }) => {
    await page.getByRole('button', { name: 'Add Task' }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a task title');
  });
});

test.describe('Expense form: @category autocomplete', () => {
  test.beforeEach(async ({ page }) => openForm(page, 'New Expense'));
  const title = (page: Page) => page.getByLabel('Expense title');

  test('list shows all 8 categories and filters by prefix', async ({ page }) => {
    await title(page).fill('Run @');
    await expect(page.locator(OPT)).toHaveCount(8);
    await title(page).fill('Run @gro');
    await expect(page.locator(OPT)).toHaveCount(1);
  });

  test('picking removes the token from the title and sets the category', async ({ page }) => {
    await title(page).fill('Weekly run @rent');
    await page.keyboard.press('Enter');
    await expect(title(page)).toHaveValue('Weekly run ');
    await expect(page.locator('select')).toHaveValue('rent');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('typed full "@water" without picking is applied on save', async ({ page }) => {
    await title(page).fill('Bill @water');
    await page.keyboard.press('Escape'); // dismiss list, keep dialog
    await page.getByPlaceholder('0.00').fill('12.5');
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    await expect(page.getByText('Expense added')).toBeVisible();
    await page.getByRole('button', { name: /Expenses/ }).click();
    await expect(page.getByText('Bill', { exact: true })).toBeVisible();
    await expect(page.getByText('@water')).toHaveCount(0);
  });

  test('title that is only "@grocery" is rejected', async ({ page }) => {
    await title(page).fill('@grocery');
    await page.keyboard.press('Escape');
    await page.getByPlaceholder('0.00').fill('5');
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Enter a title');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('regression: normal add without "@", and "other" requires custom name', async ({ page }) => {
    await title(page).fill('Coffee');
    await page.getByPlaceholder('0.00').fill('3');
    await page.locator('select').selectOption('other');
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('custom category');
    await page.getByPlaceholder(/Subscriptions/).fill('Treats');
    await page.getByRole('button', { name: 'Add Expense', exact: true }).click();
    await expect(page.getByText('Expense added')).toBeVisible();
  });
});
