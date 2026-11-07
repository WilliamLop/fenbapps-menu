import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SCREENSHOT_DIR =
  "/Users/fenbsru/.gemini/antigravity/brain/233816f3-fa5e-405b-a938-1117a23aa4c4/audit-screenshots";
const BASE_URL = "http://localhost:3000";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function verifyPhase2UI() {
  console.log("Starting Phase 2 UI verification & screenshot capture...");
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Viewport (1440x900)
  const contextDesk = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const pageDesk = await contextDesk.newPage();

  // Route 1: Dashboard with 104 dishes, faceted filters, and pagination
  console.log("Navigating to /dashboard/casa-brasa (Desktop)...");
  await pageDesk.goto(`${BASE_URL}/dashboard/casa-brasa`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await pageDesk.waitForTimeout(1000);

  // Check horizontal overflow
  const deskOverflow = await pageDesk.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`Desktop horizontal overflow: ${deskOverflow}`);

  // Screenshot 1: Full dashboard initial state with faceted filters
  await pageDesk.screenshot({
    path: path.join(SCREENSHOT_DIR, "iter8-dashboard-faceted-filters-desktop.png"),
    fullPage: false,
  });

  // Filter by category: "Coctelería de Autor & Ahumados"
  const cocktailsCategoryBtn = pageDesk
    .locator("button")
    .filter({ hasText: "Coctelería" })
    .first();
  if (await cocktailsCategoryBtn.count() > 0) {
    await cocktailsCategoryBtn.click();
    await pageDesk.waitForTimeout(600);
    await pageDesk.screenshot({
      path: path.join(SCREENSHOT_DIR, "iter8-dashboard-filter-category-cocktails.png"),
      fullPage: false,
    });
    // Reset to "Todas"
    const allCategoriesBtn = pageDesk
      .locator("button")
      .filter({ hasText: "Todas" })
      .first();
    if (await allCategoriesBtn.count() > 0) {
      await allCategoriesBtn.click();
      await pageDesk.waitForTimeout(400);
    }
  }

  // Open "Gestionar Categorías" modal
  const manageCategoriesBtn = pageDesk
    .locator("button")
    .filter({ hasText: "Gestionar Categorías" })
    .first();
  if (await manageCategoriesBtn.count() > 0) {
    console.log("Opening Category Manager modal...");
    await manageCategoriesBtn.click();
    await pageDesk.waitForTimeout(600);
    await pageDesk.screenshot({
      path: path.join(SCREENSHOT_DIR, "iter8-dashboard-category-manager-modal.png"),
      fullPage: false,
    });
    // Close modal
    const closeBtn = pageDesk.locator('button[aria-label="Cerrar modal"]').or(pageDesk.locator("button:has-text('Cancelar')")).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
      await pageDesk.waitForTimeout(400);
    }
  }

  // Open "Nuevo Plato" modal
  const newProductBtn = pageDesk
    .locator("button")
    .filter({ hasText: "Nuevo Plato" })
    .first();
  if (await newProductBtn.count() > 0) {
    console.log("Opening New Product Editor modal...");
    await newProductBtn.click();
    await pageDesk.waitForTimeout(600);
    await pageDesk.screenshot({
      path: path.join(SCREENSHOT_DIR, "iter8-dashboard-product-editor-modal-new.png"),
      fullPage: false,
    });

    // Click "Modificadores & Opciones" tab inside modal
    const modifiersTabBtn = pageDesk
      .locator("button")
      .filter({ hasText: "Modificadores" })
      .first();
    if (await modifiersTabBtn.count() > 0) {
      await modifiersTabBtn.click();
      await pageDesk.waitForTimeout(400);
      await pageDesk.screenshot({
        path: path.join(SCREENSHOT_DIR, "iter8-dashboard-product-editor-modal-modifiers.png"),
        fullPage: false,
      });
    }

    // Close modal
    const cancelProductBtn = pageDesk
      .locator("button")
      .filter({ hasText: "Cancelar" })
      .first();
    if (await cancelProductBtn.count() > 0) {
      await cancelProductBtn.click();
      await pageDesk.waitForTimeout(400);
    }
  }

  // 2. Mobile Viewport (390x844)
  const contextMob = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const pageMob = await contextMob.newPage();

  console.log("Navigating to /dashboard/casa-brasa (Mobile)...");
  await pageMob.goto(`${BASE_URL}/dashboard/casa-brasa`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await pageMob.waitForTimeout(1000);

  const mobOverflow = await pageMob.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`Mobile horizontal overflow: ${mobOverflow}`);

  await pageMob.screenshot({
    path: path.join(SCREENSHOT_DIR, "iter8-dashboard-faceted-filters-mobile.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("Phase 2 UI verification completed successfully!");
}

verifyPhase2UI().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
