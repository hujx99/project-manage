import { expect, test } from '@playwright/test';
import {
  BACKEND_BASE_URL,
  expectNoFrontendIssues,
  fillInput,
  fillTextArea,
  selectOption,
  trackPageHealth,
  uniqueValue,
} from './test-helpers';

test.describe('Create Flow', () => {
  test('desktop can create project contract and payment end-to-end', async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'desktop interaction flow');

    const issues = trackPageHealth(page);
    const projectCode = uniqueValue('UI-PJ');
    const projectName = uniqueValue('UI项目');
    const contractCode = uniqueValue('UI-HT');
    const contractName = uniqueValue('UI合同');
    const paymentPhase = uniqueValue('首付款阶段');

    await page.goto('/projects');
    await page.waitForResponse((response) => response.url().includes('/api/projects') && response.ok());
    await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);

    await page.getByRole('button', { name: '新建项目' }).click();
    const projectDialog = page.locator('.ant-modal:visible').last();
    await expect(projectDialog).toBeVisible();
    await expect(projectDialog).toContainText('新建项目');
    await fillInput(projectDialog, '项目编号', projectCode);
    await fillInput(projectDialog, '项目名称', projectName);
    await fillInput(projectDialog, '金额', '188000');
    await fillInput(projectDialog, '负责人', 'Playwright项目负责人');
    await fillTextArea(projectDialog, '备注', '由 Playwright 自动创建的项目');
    await projectDialog.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(projectDialog).toBeHidden();

    await page.getByPlaceholder('搜索项目编号或项目名称').fill(projectName);
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/projects') && response.ok()),
      page.getByPlaceholder('搜索项目编号或项目名称').press('Enter'),
    ]);
    await expect(page.locator('.ant-table-tbody')).toContainText(projectName);

    await page.goto('/contracts');
    await page.waitForResponse((response) => response.url().includes('/api/contracts') && response.ok());
    await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);

    await page.getByRole('button', { name: '新建合同' }).click();
    const contractDialog = page.locator('.ant-modal:visible').last();
    await expect(contractDialog).toBeVisible();
    await expect(contractDialog).toContainText('新建合同');
    await selectOption(page, contractDialog, '所属项目', projectName);
    await fillInput(contractDialog, '合同编号', contractCode);
    await fillInput(contractDialog, '合同名称', contractName);
    await fillInput(contractDialog, '供应商', 'Playwright供应商');
    await fillInput(contractDialog, '合同金额', '88000');
    await fillTextArea(contractDialog, '备注', '由 Playwright 自动创建的合同');
    await contractDialog.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(contractDialog).toBeHidden();

    await expect(page.locator('.ant-table-tbody')).toContainText(contractName);

    await page.goto('/payments');
    await page.waitForResponse((response) => response.url().includes('/api/payments') && response.ok());
    await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);

    await page.getByRole('button', { name: '新建付款' }).click();
    const paymentDialog = page.locator('.ant-modal:visible').last();
    await expect(paymentDialog).toBeVisible();
    await expect(paymentDialog).toContainText('新建付款');
    await selectOption(page, paymentDialog, '项目', projectName);
    await selectOption(page, paymentDialog, '合同', contractName);
    await fillInput(paymentDialog, '期次', '1');
    await fillInput(paymentDialog, '付款阶段', paymentPhase);
    await fillInput(paymentDialog, '计划金额', '32000');
    await fillInput(paymentDialog, '支付说明', 'Playwright 自动新增付款');
    await fillTextArea(paymentDialog, '备注', '由 Playwright 自动创建的付款');
    await paymentDialog.locator('.ant-modal-footer .ant-btn-primary').click();
    await expect(paymentDialog).toBeHidden();

    await expect(page.locator('.ant-table-tbody')).toContainText(contractName);
    await expect(page.locator('.ant-table-tbody')).toContainText(paymentPhase);

    const projectResponse = await request.get(`${BACKEND_BASE_URL}/api/projects`, {
      params: { page: 1, page_size: 10, search: projectCode },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const projectResult = (await projectResponse.json()) as {
      items: Array<{ id: number; project_code: string; project_name: string }>;
    };
    const createdProject = projectResult.items.find((item) => item.project_code === projectCode);
    expect(createdProject).toBeTruthy();

    const contractResponse = await request.get(`${BACKEND_BASE_URL}/api/contracts`);
    expect(contractResponse.ok()).toBeTruthy();
    const contractResult = (await contractResponse.json()) as Array<{
      id: number;
      project_id: number;
      contract_code: string;
      contract_name: string;
    }>;
    const createdContract = contractResult.find((item) => item.contract_code === contractCode);
    expect(createdContract).toBeTruthy();
    expect(createdContract?.project_id).toBe(createdProject?.id);

    const paymentResponse = await request.get(`${BACKEND_BASE_URL}/api/payments`, {
      params: { contract_id: createdContract?.id },
    });
    expect(paymentResponse.ok()).toBeTruthy();
    const paymentResult = (await paymentResponse.json()) as Array<{
      phase: string | null;
      payment_status: string;
      pending_amount: number | null;
    }>;
    const createdPayment = paymentResult.find((item) => item.phase === paymentPhase);
    expect(createdPayment).toBeTruthy();
    expect(createdPayment?.payment_status).toBe('未付');
    expect(Number(createdPayment?.pending_amount)).toBe(32000);

    await expectNoFrontendIssues(page, issues);
  });
});
