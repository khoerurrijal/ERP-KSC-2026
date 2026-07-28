const { test, expect } = require('@playwright/test');

test.describe('Master Data Customers', () => {
  test('Should login and successfully add a new customer', async ({ page }) => {
    // Set a very high timeout (3 minutes) to accommodate slow network responses from the remote database
    test.setTimeout(180000);

    // Register dialog listener to print any alert error messages
    page.on('dialog', dialog => {
      console.log(`DIALOG SHOWED: [${dialog.type()}] ${dialog.message()}`);
      dialog.dismiss().catch(() => {});
    });

    // 1. Go to Login Page
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 2. Perform Login
    await page.fill('input[name="username"]', 'test-playwright');
    await page.fill('input[name="password"]', 'PlaywrightTest123!');
    await page.click('button[type="submit"]');

    // Wait for URL redirection to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // 4. Navigate to Customers Master Page
    await page.goto('/dashboard/master/customers', { waitUntil: 'domcontentloaded' });

    // 5. Verify the Customers page loaded (wait for the page header to appear)
    const header = page.locator('h1');
    await expect(header).toContainText('Pelanggan', { timeout: 30000 });

    // 6. Click "Tambah Pelanggan" button
    await page.click('button:has-text("Tambah Pelanggan")');

    // 7. Fill the form in the modal
    const uniqueName = `CUST-TEST-${Date.now()}`;
    await page.fill('input[placeholder="Contoh: Kedai Kopi XYZ"]', uniqueName);
    await page.fill('input[placeholder="0812..."]', '081234567890');
    await page.fill('input[placeholder="Misal: Jakarta Barat"]', 'Jakarta Selatan');

    // Select Customer Type using CustomSelect UI interaction
    // Click the dropdown trigger button (which displays the default "REGULLER")
    await page.locator('button').filter({ hasText: /^REGULLER$/ }).click();
    
    // Wait for the "RESELLER" option span to be visible in the dropdown, then click it
    const resellerOption = page.locator('button[type="button"] span').filter({ hasText: /^RESELLER$/i });
    await expect(resellerOption).toBeVisible({ timeout: 10000 });
    await resellerOption.click();

    // 8. Click "Simpan"
    await page.click('button:has-text("Simpan")');

    // 9. Verify the new customer name appears in the table
    const tableRow = page.locator('table tbody tr');
    await expect(tableRow.filter({ hasText: uniqueName })).toBeVisible({ timeout: 30000 });

    // Verify properties of the added row
    const row = tableRow.filter({ hasText: uniqueName });
    await expect(row).toContainText('081234567890');
    await expect(row).toContainText('RESELLER', { ignoreCase: true });
    await expect(row).toContainText('Jakarta Selatan');
  });
});
