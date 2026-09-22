import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const tenant = process.env.UAT_TENANT_SLUG;
if (!tenant) throw new Error('UAT_TENANT_SLUG is required for enterprise browser assurance');

interface RoleAssurance {
  role: string;
  storageState: string;
  deniedRoutes?: string[];
}

function roleMatrix(): RoleAssurance[] {
  const matrixSource = process.env.UAT_ROLE_MATRIX_FILE
    ? fs.readFileSync(process.env.UAT_ROLE_MATRIX_FILE, 'utf8')
    : process.env.UAT_ROLE_MATRIX;
  if (matrixSource) {
    const parsed = JSON.parse(matrixSource) as RoleAssurance[];
    if (!Array.isArray(parsed) || !parsed.length)
      throw new Error('UAT_ROLE_MATRIX must be a non-empty JSON array');
    for (const entry of parsed) {
      if (!entry.role || !entry.storageState || !fs.existsSync(entry.storageState)) {
        throw new Error(`Invalid browser assurance state for role '${entry.role || 'unknown'}'`);
      }
    }
    return parsed;
  }
  const storageState = process.env.UAT_STORAGE_STATE ?? '';
  if (!storageState || !fs.existsSync(storageState)) {
    throw new Error('UAT_STORAGE_STATE must point to an authenticated staging browser state');
  }
  return [{ role: process.env.UAT_ROLE ?? 'super_admin', storageState }];
}

const criticalRoutes = [
  'dashboard',
  'admission',
  'accounts',
  'procurement',
  'report-center',
  'data-portability',
  'accreditation',
] as const;

async function assertPageAssurance(
  page: import('@playwright/test').Page,
  failedResponses: string[],
) {
  await expect(page).not.toHaveURL(/\/auth\/(?:signin|login)/);
  await expect(page.locator('main')).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations, JSON.stringify(accessibility.violations, null, 2)).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).not.toHaveCount(0);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect(failedResponses, failedResponses.join('\n')).toEqual([]);

  const unlabeledControls = await page
    .locator('input:visible, select:visible, textarea:visible')
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const element = control as HTMLInputElement;
          if (element.type === 'hidden') return false;
          const id = element.id;
          const labelledBy = element.getAttribute('aria-labelledby');
          return !(
            element.getAttribute('aria-label') ||
            (labelledBy && document.getElementById(labelledBy)) ||
            (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
            element.closest('label')
          );
        })
        .map((control) => (control as HTMLElement).outerHTML.slice(0, 220)),
    );
  expect(unlabeledControls, `Unlabelled form controls:\n${unlabeledControls.join('\n')}`).toEqual(
    [],
  );
}

async function assertVisibleTabStates(
  page: import('@playwright/test').Page,
  failedResponses: string[],
) {
  const tabs = page.locator('[role="tab"]:visible');
  const tabCount = await tabs.count();
  for (let index = 0; index < tabCount; index += 1) {
    const tab = tabs.nth(index);
    if ((await tab.isDisabled().catch(() => true)) || !(await tab.isVisible())) continue;
    failedResponses.length = 0;
    await tab.click();
    await page.waitForLoadState('networkidle');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await assertPageAssurance(page, failedResponses);
  }
}

for (const entry of roleMatrix()) {
  test.describe(`${entry.role} portal`, () => {
    test.use({ storageState: entry.storageState });

    test('every visible navigation page is accessible and responsive', async ({ page }) => {
      const failedResponses: string[] = [];
      page.on('response', (response) => {
        if (response.status() >= 500)
          failedResponses.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(`/${tenant}/${entry.role}/dashboard`, { waitUntil: 'networkidle' });
      const prefix = `/${tenant}/${entry.role}/`;
      const hrefs = await page
        .locator(`a[href^="${prefix}"]`)
        .evaluateAll(
          (links, expectedPrefix) =>
            [...new Set(links.map((link) => (link as HTMLAnchorElement).pathname))].filter((href) =>
              href.startsWith(expectedPrefix as string),
            ),
          prefix,
        );
      expect(
        hrefs.length,
        `No authorized navigation links found for ${entry.role}`,
      ).toBeGreaterThan(0);

      for (const href of hrefs) {
        failedResponses.length = 0;
        await page.goto(href, { waitUntil: 'networkidle' });
        await assertPageAssurance(page, failedResponses);
        await assertVisibleTabStates(page, failedResponses);
      }
    });

    for (const route of criticalRoutes) {
      test(`${route} has no server failures when authorized`, async ({ page }) => {
        const failedResponses: string[] = [];
        page.on('response', (response) => {
          if (response.status() >= 500)
            failedResponses.push(`${response.status()} ${response.url()}`);
        });
        await page.goto(`/${tenant}/${entry.role}/${route}`, { waitUntil: 'networkidle' });
        const denied = await page
          .getByText(/access denied|permission denied|not authorized/i)
          .isVisible()
          .catch(() => false);
        if (!denied) await assertPageAssurance(page, failedResponses);
        else expect(failedResponses, failedResponses.join('\n')).toEqual([]);
        if (route === 'accreditation' && !denied) {
          await expect(page.getByRole('heading', { name: /accreditation/i }).first()).toBeVisible();
          await expect(page.getByText(/not direct portal submissions/i).first()).toBeVisible();
        }
      });
    }

    for (const route of entry.deniedRoutes ?? []) {
      test(`${route} is denied`, async ({ page }) => {
        await page.goto(`/${tenant}/${entry.role}/${route}`, { waitUntil: 'networkidle' });
        await expect(
          page
            .getByText(/access denied|permission denied|not authorized|do not have permission/i)
            .first(),
        ).toBeVisible();
      });
    }
  });
}

/*
  Legacy single-role route list retained as a documented minimum for staging matrices:
  dashboard, admission, accounts, procurement, report-center, data-portability.
*/
