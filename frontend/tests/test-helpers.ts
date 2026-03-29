import { expect, type APIRequestContext, type APIResponse, type Locator, type Page } from '@playwright/test';

const BACKEND_PORT = process.env.PLAYWRIGHT_BACKEND_PORT ?? '18000';
export const BACKEND_BASE_URL = process.env.PLAYWRIGHT_BACKEND_BASE_URL ?? `http://127.0.0.1:${BACKEND_PORT}`;

export interface TestProject {
  id: number;
  project_code: string;
  project_name: string;
}

export interface TestContract {
  id: number;
  project_id: number;
  contract_code: string;
  contract_name: string;
}

export interface TestPayment {
  id: number;
  contract_id: number;
  seq: number | null;
  phase: string | null;
  payment_status: string;
  pending_amount: number | null;
}

const IGNORED_CONSOLE_ERRORS = ['There may be circular references'];

export function uniqueValue(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function parseJson<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`HTTP ${response.status()}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export function trackPageHealth(page: Page) {
  const issues: string[] = [];

  page.on('pageerror', (error) => {
    issues.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (IGNORED_CONSOLE_ERRORS.some((pattern) => text.includes(pattern))) {
        return;
      }

      issues.push(`console: ${text}`);
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

export async function expectNoFrontendIssues(page: Page, issues: string[]) {
  await expect(page.locator('.ant-message-notice-content .ant-message-error')).toHaveCount(0);
  expect(issues, issues.join('\n')).toEqual([]);
}

export async function createProjectViaApi(
  request: APIRequestContext,
  overrides?: Partial<{
    project_code: string;
    project_name: string;
    project_type: string;
    status: string;
    budget: number;
    manager: string;
    remark: string;
  }>,
): Promise<TestProject> {
  const payload = {
    project_code: uniqueValue('E2E-PJ'),
    project_name: uniqueValue('E2E项目'),
    project_type: '研发项目',
    status: '立项',
    budget: 128000,
    manager: 'Playwright',
    remark: 'Playwright test seed',
    ...overrides,
  };

  const response = await request.post(`${BACKEND_BASE_URL}/api/projects`, { data: payload });
  return parseJson<TestProject>(response);
}

export async function createContractViaApi(
  request: APIRequestContext,
  projectId: number,
  overrides?: Partial<{
    contract_code: string;
    contract_name: string;
    vendor: string;
    amount: number;
    status: string;
    payment_direction: string;
  }>,
): Promise<TestContract> {
  const payload = {
    project_id: projectId,
    contract_code: uniqueValue('E2E-HT'),
    contract_name: uniqueValue('E2E合同'),
    vendor: 'Playwright供应商',
    amount: 56000,
    status: '签订',
    payment_direction: '支出',
    items: [],
    payments: [],
    ...overrides,
  };

  const response = await request.post(`${BACKEND_BASE_URL}/api/contracts`, { data: payload });
  return parseJson<TestContract>(response);
}

export async function createPaymentViaApi(
  request: APIRequestContext,
  contractId: number,
  overrides?: Partial<{
    seq: number;
    phase: string;
    planned_amount: number;
    actual_amount: number;
    payment_status: string;
    description: string;
    remark: string;
  }>,
): Promise<TestPayment> {
  const payload = {
    contract_id: contractId,
    seq: 1,
    phase: '首付款',
    planned_amount: 12000,
    actual_amount: 0,
    payment_status: '未付',
    description: 'Playwright payment seed',
    remark: 'Playwright test seed',
    ...overrides,
  };

  const response = await request.post(`${BACKEND_BASE_URL}/api/payments`, { data: payload });
  return parseJson<TestPayment>(response);
}

export async function provisionContractFlow(request: APIRequestContext) {
  const project = await createProjectViaApi(request);
  const contract = await createContractViaApi(request, project.id);
  const payment = await createPaymentViaApi(request, contract.id);
  return { project, contract, payment };
}

function formItem(container: Locator, labelText: string): Locator {
  return container.locator('.ant-form-item').filter({ hasText: labelText }).first();
}

export async function fillInput(container: Locator, labelText: string, value: string) {
  await formItem(container, labelText).locator('input').first().fill(value);
}

export async function fillTextArea(container: Locator, labelText: string, value: string) {
  await formItem(container, labelText).locator('textarea').first().fill(value);
}

export async function selectOption(page: Page, container: Locator, labelText: string, optionText: string) {
  const targetFormItem = formItem(container, labelText);
  await targetFormItem.locator('.ant-select-selector').first().click();

  const searchInput = targetFormItem.locator('.ant-select-selection-search-input').first();
  const visibleDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await expect(visibleDropdown).toBeVisible();

  if ((await searchInput.count()) > 0) {
    await searchInput.fill(optionText);
    const option = visibleDropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).first();
    await expect(option).toBeVisible();
    await page.keyboard.press('Enter');
    return;
  }

  const option = visibleDropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).first();
  await expect(option).toBeVisible();
  await option.click();
}

export async function waitForSuccessMessage(page: Page, text: string) {
  await expect(page.locator('.ant-message-notice-content').filter({ hasText: text })).toBeVisible();
}
