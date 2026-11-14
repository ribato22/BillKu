import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const password = "BillKu-browser-test-only";

async function submitRegistration(page: Page, email: string, businessName: string) {
  await page.goto("/register");
  await page.locator("#businessName").fill(businessName);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.locator("button[type=submit]").click();
}

test("a browser registration creates an account that can sign in independently", async ({ page, browser, baseURL }) => {
  const email = `billku-${randomUUID()}@example.com`;
  const businessName = "BillKu Registration Test";

  await submitRegistration(page, email, businessName);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(businessName, { exact: true })).toBeVisible();

  const freshSession = await browser.newContext({ baseURL });
  try {
    const login = await freshSession.newPage();
    await login.goto("/login");
    await login.locator("#email").fill(email);
    await login.locator("#password").fill(password);
    await login.locator("button[type=submit]").click();
    await expect(login).toHaveURL(/\/dashboard$/);
    await expect(login.getByText(businessName, { exact: true })).toBeVisible();
  } finally {
    await freshSession.close();
  }
});

test("a duplicate email shows a registration error and leaves the form open", async ({ page, request }) => {
  const email = `billku-${randomUUID()}@example.com`;
  const existing = await request.post("/api/v1/auth/register", {
    data: { email, password, businessName: "Existing Business" },
  });
  expect(existing.ok()).toBe(true);

  await submitRegistration(page, email, "Duplicate Business");
  await expect(page.getByText(/Gagal mendaftar|Registration failed/)).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator("button[type=submit]")).toBeEnabled();
});
