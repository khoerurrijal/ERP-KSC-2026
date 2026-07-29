# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: add-customer.spec.js >> Master Data Customers >> Should login and successfully add a new customer
- Location: tests\add-customer.spec.js:4:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | const { test, expect } = require('@playwright/test');
  2  | 
  3  | test.describe('Master Data Customers', () => {
  4  |   test('Should login and successfully add a new customer', async ({ page }) => {
  5  |     // Set a very high timeout (3 minutes) to accommodate slow network responses from the remote database
  6  |     test.setTimeout(180000);
  7  | 
  8  |     // Register dialog listener to print any alert error messages
  9  |     page.on('dialog', dialog => {
  10 |       console.log(`DIALOG SHOWED: [${dialog.type()}] ${dialog.message()}`);
  11 |       dialog.dismiss().catch(() => {});
  12 |     });
  13 | 
  14 |     // 1. Go to Login Page
> 15 |     await page.goto('/login', { waitUntil: 'domcontentloaded' });
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  16 | 
  17 |     // 2. Perform Login
  18 |     await page.fill('input[name="username"]', 'test-playwright');
  19 |     await page.fill('input[name="password"]', 'PlaywrightTest123!');
  20 |     await page.click('button[type="submit"]');
  21 | 
  22 |     // Wait for URL redirection to dashboard
  23 |     await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
  24 | 
  25 |     // 4. Navigate to Customers Master Page
  26 |     await page.goto('/dashboard/master/customers', { waitUntil: 'domcontentloaded' });
  27 | 
  28 |     // 5. Verify the Customers page loaded (wait for the page header to appear)
  29 |     const header = page.locator('h1');
  30 |     await expect(header).toContainText('Pelanggan', { timeout: 30000 });
  31 | 
  32 |     // 6. Click "Tambah Pelanggan" button
  33 |     await page.click('button:has-text("Tambah Pelanggan")');
  34 | 
  35 |     // 7. Fill the form in the modal
  36 |     const uniqueName = `CUST-TEST-${Date.now()}`;
  37 |     await page.fill('input[placeholder="Contoh: Kedai Kopi XYZ"]', uniqueName);
  38 |     await page.fill('input[placeholder="0812..."]', '081234567890');
  39 |     await page.fill('input[placeholder="Misal: Jakarta Barat"]', 'Jakarta Selatan');
  40 | 
  41 |     // Select Customer Type using CustomSelect UI interaction
  42 |     // Click the dropdown trigger button (which displays the default "REGULLER")
  43 |     await page.locator('button').filter({ hasText: /^REGULLER$/ }).click();
  44 |     
  45 |     // Wait for the "RESELLER" option span to be visible in the dropdown, then click it
  46 |     const resellerOption = page.locator('button[type="button"] span').filter({ hasText: /^RESELLER$/i });
  47 |     await expect(resellerOption).toBeVisible({ timeout: 10000 });
  48 |     await resellerOption.click();
  49 | 
  50 |     // 8. Click "Simpan"
  51 |     await page.click('button:has-text("Simpan")');
  52 | 
  53 |     // 9. Verify the new customer name appears in the table
  54 |     const tableRow = page.locator('table tbody tr');
  55 |     await expect(tableRow.filter({ hasText: uniqueName })).toBeVisible({ timeout: 30000 });
  56 | 
  57 |     // Verify properties of the added row
  58 |     const row = tableRow.filter({ hasText: uniqueName });
  59 |     await expect(row).toContainText('081234567890');
  60 |     await expect(row).toContainText('RESELLER', { ignoreCase: true });
  61 |     await expect(row).toContainText('Jakarta Selatan');
  62 |   });
  63 | });
  64 | 
```