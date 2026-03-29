import { expect, test, type Page } from '@playwright/test';

const BACKEND_BASE_URL = 'http://127.0.0.1:8000';

function trackPageHealth(page: Page) {
  const issues: string[] = [];

  page.on('pageerror', (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      issues.push(`console: ${message.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/api/')) {
      issues.push(`requestfailed: ${request.method()} ${url} ${request.failure()?.errorText ?? ''}`);
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      issues.push(`api ${response.status()}: ${url}`);
    }
  });

  return issues;
}

async function expectNoFrontendIssues(page: Page, issues: string[]) {
  await expect(page.locator('.ant-message-notice-content .ant-message-error')).toHaveCount(0);
  expect(issues, issues.join('\n')).toEqual([]);
}

test.describe('Dashboard Smoke', () => {
  test('dashboard renders analysis sections', async ({ page }) => {
    const issues = trackPageHealth(page);

    await page.goto('/');
    await page.waitForResponse((response) => response.url().includes('/api/dashboard/analysis') && response.ok());

    await expect(page.getByRole('heading', { name: '经营分析仪表盘' })).toBeVisible();
    await expect(page.getByText('执行健康度')).toBeVisible();
    await expect(page.locator('.ant-card-head-title', { hasText: '付款风险分层' })).toBeVisible();
    await expect(page.locator('.ant-card-head-title', { hasText: '责任人负载' })).toBeVisible();
    await expect(page.locator('.ant-card-head-title', { hasText: '高风险项目清单' })).toBeVisible();

    await expectNoFrontendIssues(page, issues);
  });
});

test.describe('Contracts Page Smoke', () => {
  test('desktop contract table uses fixed layout and truncation styles', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop-only layout assertion');

    const issues = trackPageHealth(page);

    await page.goto('/contracts');
    await page.waitForResponse((response) => response.url().includes('/api/contracts') && response.ok());
    await page.waitForResponse(
      (response) => response.url().includes('/api/projects?page=1&page_size=100') && response.ok(),
    );

    const dataRows = page.locator('.ant-table-tbody > tr:not(.ant-table-measure-row)');

    await expect(page.getByRole('heading', { name: '合同执行', exact: true })).toBeVisible();
    await expect(page.getByText('按项目筛选')).toBeVisible();
    await expect(dataRows.first()).toBeVisible();

    const tableLayout = await page.locator('.ant-table table').evaluate((element) => getComputedStyle(element).tableLayout);
    expect(tableLayout).toBe('fixed');

    const codeLink = dataRows.first().locator('a').first();
    await expect(codeLink).toBeVisible();

    const codeStyles = await codeLink.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        display: styles.display,
        overflow: styles.overflow,
        textOverflow: styles.textOverflow,
        whiteSpace: styles.whiteSpace,
      };
    });

    expect(codeStyles).toEqual({
      display: 'block',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });

    await expectNoFrontendIssues(page, issues);
  });

  test('mobile contract list exposes aggregated subtitle info', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only layout assertion');

    const issues = trackPageHealth(page);

    await page.goto('/contracts');
    await page.waitForResponse((response) => response.url().includes('/api/contracts') && response.ok());
    const dataRows = page.locator('.ant-table-tbody > tr:not(.ant-table-measure-row)');
    await expect(page.getByRole('heading', { name: '合同执行', exact: true })).toBeVisible();

    const firstRow = dataRows.first();
    await expect(firstRow.locator('.table-cell-subtitle').first()).toBeVisible();
    await expect(firstRow.locator('.table-cell-meta').first()).toBeVisible();

    await expectNoFrontendIssues(page, issues);
  });
});

test.describe('Detail Page Smoke', () => {
  test('project and contract detail pages load with live data', async ({ page, request }) => {
    const issues = trackPageHealth(page);

    const contractsResponse = await request.get(`${BACKEND_BASE_URL}/api/contracts`);
    expect(contractsResponse.ok()).toBeTruthy();
    const contracts = (await contractsResponse.json()) as Array<{ id: number; project_id: number; contract_name: string }>;
    expect(contracts.length).toBeGreaterThan(0);

    const contract = contracts[0];

    await page.goto(`/projects/${contract.project_id}`);
    await expect(page.getByText('项目详情：')).toBeVisible();
    await expect(page.getByText('合同总金额')).toBeVisible();

    await page.goto(`/contracts/${contract.id}`);
    await expect(page.getByText('合同详情：')).toBeVisible();
    await expect(page.getByText('付款计划')).toBeVisible();

    await expectNoFrontendIssues(page, issues);
  });
});

test.describe('Imports Page Smoke', () => {
  test('imports page renders both screenshot and excel sections', async ({ page }) => {
    const issues = trackPageHealth(page);

    await page.goto('/imports');
    await expect(page.getByRole('heading', { name: '数据导入', exact: true })).toBeVisible();
    await expect(page.locator('.ant-card-head-title', { hasText: 'AI截图识别' })).toBeVisible();
    await expect(page.locator('.ant-card-head-title', { hasText: 'Excel导入' })).toBeVisible();

    await expectNoFrontendIssues(page, issues);
  });
});
