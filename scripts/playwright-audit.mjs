import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const SCREENSHOT_DIR =
  "/Users/fenbsru/.gemini/antigravity/brain/233816f3-fa5e-405b-a938-1117a23aa4c4/audit-screenshots";
const BASE_URL = "http://localhost:3000";

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844, isMobile: false },
  { name: "desktop", width: 1440, height: 900, isMobile: false },
];

const report = {
  timestamp: new Date().toISOString(),
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  routeAudits: [],
  interactiveTests: {},
};

async function collectPageMetrics(page, routeLabel, viewportName) {
  return await page.evaluate(
    ({ routeLabel, viewportName }) => {
      const docEl = document.documentElement;
      const scrollWidth = docEl.scrollWidth;
      const innerWidth = window.innerWidth;
      const hasHorizontalOverflow = scrollWidth > innerWidth;

      // Find overflowing elements if any
      const overflowingElements = [];
      for (const el of document.querySelectorAll("*")) {
        const rect = el.getBoundingClientRect();
        if (rect.right > innerWidth + 2 || rect.left < -2) {
          overflowingElements.push({
            tag: el.tagName.toLowerCase(),
            className: (el.className || "").toString().slice(0, 80),
            rectRight: Math.round(rect.right),
            innerWidth,
          });
        }
      }

      // Inspect images
      const imgs = Array.from(document.querySelectorAll("img"));
      const imgDetails = imgs.map((img) => {
        // Parse original src from Next/Image or standard src
        const rawSrc = img.getAttribute("src") || "";
        let decodedUrl = rawSrc;
        try {
          if (rawSrc.includes("url=")) {
            const u = new URL(rawSrc, window.location.origin);
            decodedUrl = decodeURIComponent(u.searchParams.get("url") || rawSrc);
          }
        } catch {
          // ignore
        }
        return {
          alt: img.alt,
          src: decodedUrl,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          loaded: img.complete && img.naturalWidth > 0,
        };
      });

      const srcCounts = {};
      for (const item of imgDetails) {
        srcCounts[item.src] = (srcCounts[item.src] || 0) + 1;
      }
      const duplicateImages = Object.entries(srcCounts)
        .filter(([, count]) => count > 1)
        .map(([src, count]) => ({
          src,
          count,
          alts: imgDetails.filter((i) => i.src === src).map((i) => i.alt),
        }));

      return {
        routeLabel,
        viewportName,
        url: window.location.href,
        title: document.title,
        scrollWidth,
        innerWidth,
        hasHorizontalOverflow,
        overflowingElements: overflowingElements.slice(0, 10),
        totalImages: imgDetails.length,
        brokenImages: imgDetails.filter((i) => !i.loaded),
        duplicateImages,
        allImages: imgDetails,
      };
    },
    { routeLabel, viewportName }
  );
}

async function runAudit() {
  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });

    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        report.consoleErrors.push({
          viewport: vp.name,
          type: msg.type(),
          url: page.url(),
          text: msg.text(),
        });
      }
    });

    page.on("pageerror", (err) => {
      report.pageErrors.push({
        viewport: vp.name,
        url: page.url(),
        message: err.message,
      });
    });

    page.on("response", (res) => {
      if (res.status() >= 400) {
        report.failedRequests.push({
          viewport: vp.name,
          url: res.url(),
          status: res.status(),
          pageUrl: page.url(),
        });
      }
    });

    // 1. Audit "/" -> "/casa-brasa"
    console.log(`[${vp.name}] Auditing / -> /casa-brasa...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-home-${vp.name}-top.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-home-${vp.name}-full.png`),
      fullPage: true,
    });
    report.routeAudits.push(
      await collectPageMetrics(page, "/casa-brasa", vp.name)
    );

    // 2. Audit "/casa-brasa/menu"
    console.log(`[${vp.name}] Auditing /casa-brasa/menu...`);
    await page.goto(`${BASE_URL}/casa-brasa/menu`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `02-menu-${vp.name}-initial.png`),
      fullPage: false,
    });

    // Check products and categories on menu page
    const menuData = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll("article"));
      return articles.map((a) => ({
        title: a.querySelector("h3")?.textContent?.trim(),
        badgeText: a.textContent?.includes("Agotado por hoy")
          ? "sold_out"
          : "available",
        hasOptions: a.textContent?.includes("Ver términos y guarniciones"),
      }));
    });

    // Scroll down 500px to test sticky navbar vs sticky category bar overlap!
    await page.evaluate(() => window.scrollTo({ top: 520, behavior: "instant" }));
    await page.waitForTimeout(300);
    const stickyMetrics = await page.evaluate(() => {
      const header = document.querySelector("header");
      const tablist = document.querySelector('[role="tablist"]');
      const hRect = header ? header.getBoundingClientRect() : null;
      const tRect = tablist ? tablist.getBoundingClientRect() : null;
      const overlaps =
        hRect && tRect ? hRect.bottom > tRect.top + 1 : false;
      return {
        headerRect: hRect
          ? {
              top: Math.round(hRect.top),
              bottom: Math.round(hRect.bottom),
              height: Math.round(hRect.height),
            }
          : null,
        tablistRect: tRect
          ? {
              top: Math.round(tRect.top),
              bottom: Math.round(tRect.bottom),
              height: Math.round(tRect.height),
            }
          : null,
        overlaps,
        overlapPixels:
          hRect && tRect ? Math.round(hRect.bottom - tRect.top) : 0,
        totalStickyHeight:
          hRect && tRect ? Math.round(Math.max(hRect.bottom, tRect.bottom)) : 0,
      };
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `03-menu-${vp.name}-sticky-scroll.png`),
      fullPage: false,
    });

    // Scroll to compact_list section
    const compactSection = page.locator("text=Selección en Formato de Carta Clásica").first();
    if ((await compactSection.count()) > 0) {
      await compactSection.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -140));
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `04-menu-${vp.name}-compact-list.png`),
        fullPage: false,
      });
    }

    report.routeAudits.push(
      await collectPageMetrics(page, "/casa-brasa/menu", vp.name)
    );

    // Test Search & Highlight Filter
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(200);
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("Pulpo");
    await page.waitForTimeout(300);
    const searchResultsCount = await page.locator("article").count();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `05-menu-${vp.name}-search-pulpo.png`),
      fullPage: false,
    });
    await searchInput.fill("");
    await page.waitForTimeout(200);

    // Click "Insignias del Chef" filter
    const highlightsBtn = page.locator("button", { hasText: "Insignias del Chef" });
    await highlightsBtn.click();
    await page.waitForTimeout(200);
    const highlightsCount = await page.locator("article").count();
    await highlightsBtn.click(); // reset
    await page.waitForTimeout(200);

    // Open product detail modal with variants (specifically "Ribeye Cowboy 700g" if present, else first with options)
    const cowboyCard = page
      .locator("article", { hasText: "Ribeye Cowboy" })
      .first();
    const productWithOptions =
      (await cowboyCard.count()) > 0
        ? cowboyCard
        : page
            .locator("article", { hasText: "Ver términos y guarniciones" })
            .first();
    await productWithOptions.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const clickedProductTitle = await productWithOptions
      .locator("h3")
      .textContent();
    await productWithOptions.click();
    await page.waitForTimeout(400);

    const dialog = page.locator('[role="dialog"]');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `06a-menu-${vp.name}-modal-opened.png`),
      fullPage: false,
    });

    const modalDebug = await page.evaluate(() => {
      const dlg = document.querySelector('[role="dialog"]');
      if (!dlg) return null;
      const scroller = dlg.querySelector(".overflow-y-auto");
      const btns = Array.from(dlg.querySelectorAll("button")).map((b) => {
        const r = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height),
          className: b.className,
        };
      });
      return {
        scrollerScrollHeight: scroller?.scrollHeight,
        scrollerClientHeight: scroller?.clientHeight,
        btns,
      };
    });

    const initialModalPrice = await dialog
      .locator(".tabular-price")
      .last()
      .textContent();

    // Scroll modal inner container to bottom so options and price footer are clearly visible
    await page.evaluate(() => {
      const scroller = document.querySelector('[role="dialog"] .overflow-y-auto');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await page.waitForTimeout(300);

    // Select an option with "+ $" price delta
    const plusOptionBtn = dialog.locator("button", { hasText: "+ $" }).first();
    let updatedModalPrice = initialModalPrice;
    let clickedDeltaOptionText = null;
    if ((await plusOptionBtn.count()) > 0) {
      clickedDeltaOptionText = await plusOptionBtn.textContent();
      try {
        await plusOptionBtn.click({ timeout: 4000 });
      } catch (err) {
        console.log(`[${vp.name}] Standard click on plusOptionBtn intercepted:`, err.message.split("\n")[0]);
        await plusOptionBtn.evaluate((el) => el.click());
      }
      await page.waitForTimeout(300);
      updatedModalPrice = await dialog
        .locator(".tabular-price")
        .last()
        .textContent();
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `06b-menu-${vp.name}-modal-variants.png`),
      fullPage: false,
    });

    // Close modal
    await dialog
      .locator('button[aria-label*="Cerrar"]')
      .first()
      .evaluate((el) => el.click());
    await page.waitForTimeout(300);

    // 3. Audit "/casa-brasa/eventos"
    console.log(`[${vp.name}] Auditing /casa-brasa/eventos...`);
    await page.goto(`${BASE_URL}/casa-brasa/eventos`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `07-eventos-${vp.name}-spaces.png`),
      fullPage: false,
    });

    report.routeAudits.push(
      await collectPageMetrics(page, "/casa-brasa/eventos", vp.name)
    );

    // Scroll to packages
    const packagesHeading = page.locator("h2", {
      hasText: "Paquetes Comerciales & Experiencias",
    });
    await packagesHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `08-eventos-${vp.name}-packages.png`),
      fullPage: false,
    });

    // Click second space and second package to test pre-selection
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(200);
    const spaceCards = page.locator("section").nth(1).locator("article");
    const spaceCount = await spaceCards.count();
    let secondSpaceName = "";
    if (spaceCount > 1) {
      secondSpaceName =
        (await spaceCards.nth(1).locator("h3").textContent()) || "";
      await spaceCards.nth(1).click();
      await page.waitForTimeout(200);
    }

    // Click "Elegir este paquete para cotizar" on one of the packages
    const choosePkgBtn = page
      .locator("button", { hasText: "Elegir este paquete para cotizar" })
      .first();
    if ((await choosePkgBtn.count()) > 0) {
      await choosePkgBtn.click();
      await page.waitForTimeout(500);
    }

    // Scroll to inquiry form & screenshot before submit
    const formSection = page.locator("#solicitud-cotizacion-eventos");
    await formSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `09-eventos-${vp.name}-form.png`),
      fullPage: false,
    });

    // Check if there is any live reference estimate displayed inside #solicitud-cotizacion-eventos
    const formText = (await formSection.textContent()) || "";
    const hasLiveEstimateInForm =
      formText.toLowerCase().includes("estimado") &&
      formText.includes("$");

    // Fill out and submit the inquiry form (only submit on mobile or both to verify E2E)
    await page.fill("#eventType", `Cena Ejecutiva QA (${vp.name})`);
    await page.fill("#guestCount", "28");
    await page.fill("#customerName", `Valeria Mendoza (${vp.name})`);
    await page.fill("#customerPhone", "+57 310 555 9876");
    await page.fill("#customerEmail", `valeria.${vp.name}@empresa.co`);
    await page.fill("#companyName", "Andes Capital Partners");
    await page.fill(
      "#specialRequests",
      "Requerimos pantalla para presentación breve, 2 menús vegetarianos y mesa imperial."
    );
    await page.check("#privacyAccepted");
    await page.waitForTimeout(200);

    await page.click('button[type="submit"]');
    // Wait for confirmation state
    await page.waitForSelector("text=CÓDIGO DE SOLICITUD:", { timeout: 10000 });
    await page.waitForTimeout(400);

    const refBadgeText = await page
      .locator("text=CÓDIGO DE SOLICITUD:")
      .first()
      .textContent();
    const waLinkHref = await page
      .locator('a[href*="wa.me"]')
      .first()
      .getAttribute("href");

    await page.screenshot({
      path: path.join(
        SCREENSHOT_DIR,
        `10-eventos-${vp.name}-confirmation.png`
      ),
      fullPage: false,
    });

    // 4. Audit "/dashboard/casa-brasa"
    console.log(`[${vp.name}] Auditing /dashboard/casa-brasa...`);
    await page.goto(`${BASE_URL}/dashboard/casa-brasa`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `11-dashboard-${vp.name}-top.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `11-dashboard-${vp.name}-full.png`),
      fullPage: true,
    });

    report.routeAudits.push(
      await collectPageMetrics(page, "/dashboard/casa-brasa", vp.name)
    );

    report.interactiveTests[vp.name] = {
      menuProductsCount: menuData.length,
      soldOutProductsOnMenu: menuData.filter((p) => p.badgeText === "sold_out"),
      stickyMetrics,
      searchResultsForPulpo: searchResultsCount,
      highlightsFilterCount: highlightsCount,
      modalTest: {
        clickedProductTitle,
        initialModalPrice,
        clickedDeltaOptionText,
        updatedModalPrice,
        modalDebug,
      },
      eventsTest: {
        spaceCount,
        secondSpaceName,
        hasLiveEstimateInForm,
        refBadgeText,
        waLinkHref,
      },
    };

    await context.close();
  }

  await browser.close();

  const reportPath = path.join(SCREENSHOT_DIR, "audit-telemetry.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Audit complete! Telemetry written to ${reportPath}`);
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
