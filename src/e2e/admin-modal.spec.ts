import { test, expect } from '@playwright/test';

test.describe('Admin Modal E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and open admin modal
    await page.goto('/');
    await page.click('[data-testid="admin-settings-button"]'); // Assuming there's a button to open admin modal
    await page.waitForSelector('[data-testid="admin-modal"]');
  });

  test('should open admin modal and show default tab', async ({ page }) => {
    await expect(page.locator('[data-testid="admin-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-general"]')).toHaveClass(/active/);
  });

  test('should switch between tabs', async ({ page }) => {
    // Switch to Providers tab
    await page.click('[data-testid="tab-providers"]');
    await expect(page.locator('[data-testid="providers-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-providers"]')).toHaveClass(/active/);

    // Switch to Workflows tab
    await page.click('[data-testid="tab-workflows"]');
    await expect(page.locator('[data-testid="workflows-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-workflows"]')).toHaveClass(/active/);

    // Switch to Operations tab
    await page.click('[data-testid="tab-operations"]');
    await expect(page.locator('[data-testid="operations-tab"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-operations"]')).toHaveClass(/active/);
  });

  test('should create and delete provider', async ({ page }) => {
    await page.click('[data-testid="tab-providers"]');
    
    // Fill provider form
    await page.fill('[data-testid="provider-name"]', 'Test Provider');
    await page.selectOption('[data-testid="provider-type"]', 'openai');
    await page.fill('[data-testid="provider-model-id"]', 'gpt-4');
    
    // Submit form
    await page.click('[data-testid="add-provider-button"]');
    
    // Verify success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Provider added');
    
    // Find and delete the provider
    const providerItem = page.locator('[data-testid="provider-item"]').filter({ hasText: 'Test Provider' });
    await providerItem.locator('[data-testid="delete-provider"]').click();
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Provider deleted');
  });

  test('should create and configure workflow', async ({ page }) => {
    await page.click('[data-testid="tab-workflows"]');
    
    // Create workflow
    await page.fill('[data-testid="workflow-name"]', 'Test Workflow');
    await page.fill('[data-testid="workflow-definition"]', JSON.stringify({
      steps: ['analyze', 'review', 'comment']
    }));
    
    await page.click('[data-testid="create-workflow-button"]');
    
    // Verify success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Workflow created');
    
    // Select the workflow
    await page.click('[data-testid="workflow-item"]').filter({ hasText: 'Test Workflow' });
    
    // Configure agent mapping
    await page.selectOption('[data-testid="agent-primary-model"]', 'gpt-4');
    await page.selectOption('[data-testid="agent-collaborator-model"]', 'gpt-3.5-turbo');
    
    // Save changes
    await page.click('[data-testid="save-workflow-button"]');
    
    // Verify success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Workflow updated');
    
    // Delete workflow
    await page.click('[data-testid="delete-workflow-button"]');
    await page.click('[data-testid="confirm-delete"]');
    
    // Verify success toast
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-success"]')).toContainText('Workflow deleted');
  });

  test('should display operations tab data', async ({ page }) => {
    await page.click('[data-testid="tab-operations"]');
    
    // Check infrastructure section
    await expect(page.locator('[data-testid="infrastructure-health"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
    await expect(page.locator('[data-testid="uptime"]')).toBeVisible();
    await expect(page.locator('[data-testid="cpu-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="memory-usage"]')).toBeVisible();
    
    // Check diagnostics section
    await expect(page.locator('[data-testid="diagnostics"]')).toBeVisible();
    
    // Check cost optimization section
    await expect(page.locator('[data-testid="cost-optimization"]')).toBeVisible();
    await expect(page.locator('[data-testid="provider-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-count"]')).toBeVisible();
  });

  test('should handle form validation', async ({ page }) => {
    await page.click('[data-testid="tab-providers"]');
    
    // Try to submit empty form
    await page.click('[data-testid="add-provider-button"]');
    
    // Verify validation error
    await expect(page.locator('[data-testid="toast-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="toast-warning"]')).toContainText('required');
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/admin/providers', route => route.abort());
    
    await page.click('[data-testid="tab-providers"]');
    
    // Verify error state
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should persist tab state', async ({ page }) => {
    // Switch to workflows tab
    await page.click('[data-testid="tab-workflows"]');
    
    // Create a workflow
    await page.fill('[data-testid="workflow-name"]', 'Persistent Workflow');
    await page.fill('[data-testid="workflow-definition"]', '{"steps": ["test"]}');
    await page.click('[data-testid="create-workflow-button"]');
    
    // Close and reopen modal
    await page.click('[data-testid="close-modal"]');
    await page.click('[data-testid="admin-settings-button"]');
    
    // Verify tab is reset to default but workflow persists
    await expect(page.locator('[data-testid="tab-general"]')).toHaveClass(/active/);
    
    await page.click('[data-testid="tab-workflows"]');
    await expect(page.locator('[data-testid="workflow-item"]')).toContainText('Persistent Workflow');
    
    // Cleanup
    await page.click('[data-testid="workflow-item"]').filter({ hasText: 'Persistent Workflow' });
    await page.click('[data-testid="delete-workflow-button"]');
    await page.click('[data-testid="confirm-delete"]');
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through interface
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
    
    // Use arrow keys for navigation
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Verify tab change
    await expect(page.locator('[data-testid="tab-team"]')).toHaveClass(/active/);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Verify modal adapts to mobile
    await expect(page.locator('[data-testid="admin-modal"]')).toBeVisible();
    
    // Verify sidebar collapses on mobile
    await expect(page.locator('[data-testid="admin-sidebar"]')).toHaveClass(/mobile/);
    
    // Verify content is still accessible
    await page.click('[data-testid="tab-providers"]');
    await expect(page.locator('[data-testid="providers-tab"]')).toBeVisible();
  });
});
