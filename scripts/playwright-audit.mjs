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

    // 0. Audit "/" (SaaS Showcase & Demo Switcher)
    console.log(`[${vp.name}] Auditing / (SaaS Showcase)...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(450);
    if (vp.name === "desktop") {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-saas-home.png`),
        fullPage: false,
      });
    }
    report.routeAudits.push(
      await collectPageMetrics(page, "/", vp.name)
    );

    // 1. Audit "/casa-brasa"
    console.log(`[${vp.name}] Auditing /casa-brasa...`);
    await page.goto(`${BASE_URL}/casa-brasa`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-home-${vp.name}-top.png`),
      fullPage: false,
    });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `01-home-${vp.name}-full.png`),
      fullPage: true,
    });

    // Scroll to #sedes (LocationsShowcase) & screenshot
    const sedesSection = page.locator("#sedes");
    if ((await sedesSection.count()) > 0) {
      await sedesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `01b-home-${vp.name}-locations-showcase.png`),
        fullPage: false,
      });

      // Open location modal ("Conocer sede por dentro")
      const openLocModalBtn = sedesSection
        .locator("button", { hasText: "Conocer sede por dentro" })
        .first();
      if ((await openLocModalBtn.count()) > 0) {
        await openLocModalBtn.click();
        await page.waitForTimeout(350);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `01c-home-${vp.name}-location-modal.png`),
          fullPage: false,
        });
        await page
          .locator('[role="dialog"] button[aria-label*="Cerrar"]')
          .first()
          .evaluate((el) => el.click());
        await page.waitForTimeout(250);
      }
    }

    report.routeAudits.push(
      await collectPageMetrics(page, "/casa-brasa", vp.name)
    );

    // 2. Audit "/casa-brasa/menu"
    console.log(`[${vp.name}] Auditing /casa-brasa/menu...`);
    await page.goto(`${BASE_URL}/casa-brasa/menu`, {
      waitUntil: "domcontentloaded",
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
    const compactSection = page.locator("text=Selección de Cava & Guarniciones con Referencia Visual").first();
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

    // Click "Recomendados" filter
    const highlightsBtn = page.locator("button", { hasText: "Recomendados" });
    await highlightsBtn.click();
    await page.waitForTimeout(200);
    const highlightsCount = await page.locator("article").count();
    await highlightsBtn.click(); // reset
    await page.waitForTimeout(200);

    // Open product detail modal with variants (specifically "Ribeye Ojo de Bife" if present, else first with options)
    const ribeyeCard = page
      .locator("article", { hasText: "Ribeye Ojo de Bife" })
      .first();
    const productWithOptions =
      (await ribeyeCard.count()) > 0
        ? ribeyeCard
        : page
            .locator("article", { hasText: "Términos y guarniciones" })
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

    // Click "Agregar a mi mesa" inside modal (which also closes modal)
    const addShortlistModalBtn = dialog
      .locator("button", { hasText: "Agregar a mi mesa" })
      .first();
    if ((await addShortlistModalBtn.count()) > 0) {
      await addShortlistModalBtn.evaluate((el) => el.click());
      await page.waitForTimeout(350);
    } else {
      await dialog
        .locator('button[aria-label*="Cerrar"]')
        .first()
        .evaluate((el) => el.click());
      await page.waitForTimeout(300);
    }

    // Open the Table Shortlist ("Mi Selección en Mesa · Mostrar al Mesero") drawer
    let deliveryOrderCode = null;
    const openShortlistBarBtn = page
      .locator("button", { hasText: "Mi Selección en Mesa" })
      .first();
    if ((await openShortlistBarBtn.count()) > 0) {
      await openShortlistBarBtn.click();
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `06c-menu-${vp.name}-shortlist-drawer.png`),
        fullPage: false,
      });

      // Switch to "Domicilio" mode inside the drawer to verify Dual Experience
      const deliveryTabBtn = page
        .locator('[role="dialog"] [role="tab"]', { hasText: "Domicilio" })
        .first();
      if ((await deliveryTabBtn.count()) > 0) {
        await deliveryTabBtn.click();
        await page.waitForTimeout(300);

        // Test Cash + Change calculator ("Necesito vueltas / cambio") with leading zero protection
        const needChangeBtn = page
          .locator('[role="dialog"] button', {
            hasText: "Necesito vueltas / cambio",
          })
          .first();
        if ((await needChangeBtn.count()) > 0) {
          await needChangeBtn.click();
          await page.fill("#cashBillAmountInput", "0200000");
          const sanitizedBillVal = await page.inputValue("#cashBillAmountInput");
          if (sanitizedBillVal !== "200000") {
            throw new Error(
              `Expected sanitized cash bill "200000", got "${sanitizedBillVal}"`
            );
          }
        }

        await page.screenshot({
          path: path.join(
            SCREENSHOT_DIR,
            `06d-menu-${vp.name}-delivery-checkout.png`
          ),
          fullPage: false,
        });

        if (vp.name === "desktop") {
          await page.fill("#orderCustomerName", "Santiago Vargas (QA E2E)");
          await page.fill("#orderCustomerPhone", "3115558899");
          await page.fill(
            "#orderDeliveryAddress",
            "Calle 93B # 13-45 · Oficina 402"
          );
          await page.fill("#orderDeliveryNeighborhood", "Parque de la 93");
          await page.fill(
            "#orderDeliveryNotes",
            "Entregar en recepción piso 4."
          );

          await page.click('button[form="direct-order-checkout-form"]');
          await page.waitForSelector("text=CÓDIGO CB-DOM-", { timeout: 10000 });
          await page.waitForTimeout(350);
          deliveryOrderCode = await page
            .locator("text=CÓDIGO CB-DOM-")
            .first()
            .textContent();
          await page.screenshot({
            path: path.join(
              SCREENSHOT_DIR,
              `06e-menu-${vp.name}-delivery-confirmed.png`
            ),
            fullPage: false,
          });
        }
      }

      // Close shortlist/checkout drawer
      await page
        .locator('[role="dialog"] button[aria-label*="Cerrar"]')
        .first()
        .evaluate((el) => el.click());
      await page.waitForTimeout(250);
    }

    // 3. Audit "/casa-brasa/eventos"
    console.log(`[${vp.name}] Auditing /casa-brasa/eventos...`);
    await page.goto(`${BASE_URL}/casa-brasa/eventos`, {
      waitUntil: "domcontentloaded",
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

    // Explicitly test leading-zero bug fix ("015" -> "15") on #guestCount
    await page.fill("#guestCount", "015");
    const sanitizedGuestVal = await page.inputValue("#guestCount");
    if (sanitizedGuestVal !== "15") {
      throw new Error(
        `Leading-zero regression on #guestCount: expected "15", got "${sanitizedGuestVal}"`
      );
    }

    // Fill out and submit the inquiry form on desktop
    let refBadgeText = null;
    let waLinkHref = null;
    if (vp.name === "desktop") {
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

      refBadgeText = await page
        .locator("text=CÓDIGO DE SOLICITUD:")
        .first()
        .textContent();
      waLinkHref = await page
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
    }

    // 4. Audit "/dashboard/casa-brasa"
    console.log(`[${vp.name}] Auditing /dashboard/casa-brasa...`);
    await page.goto(`${BASE_URL}/dashboard/casa-brasa`, {
      waitUntil: "domcontentloaded",
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

    // Click Tab 2: Pedidos & Domicilios
    const ordersTabBtn = page
      .locator('[role="tab"]', { hasText: "Pedidos & Domicilios" })
      .first();
    if ((await ordersTabBtn.count()) > 0) {
      await ordersTabBtn.click();
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(
          SCREENSHOT_DIR,
          `11a-dashboard-${vp.name}-pedidos-domicilios.png`
        ),
        fullPage: false,
      });
    }

    // Click Tab 3: Mini-CRM de Solicitudes de Eventos & verify status update works without constraint violation
    let crmStatusUpdateVerified = false;
    const crmTabBtn = page
      .locator('[role="tab"]', { hasText: "Mini-CRM de Solicitudes" })
      .first();
    if ((await crmTabBtn.count()) > 0) {
      await crmTabBtn.click();
      await page.waitForTimeout(350);

      if (vp.name === "desktop") {
        const qaArticle = page
          .locator("article", { hasText: "Valeria Mendoza" })
          .first();
        if ((await qaArticle.count()) > 0) {
          const statusSelect = qaArticle.locator("select").first();
          await statusSelect.selectOption("quoted");
          await page.waitForTimeout(900);
          const bannerText =
            (await page.locator('[role="status"]').first().textContent()) || "";
          if (
            bannerText.includes("violates check constraint") ||
            !bannerText.includes("actualizada correctamente")
          ) {
            throw new Error(
              `CRM status update failed in E2E! Banner text: ${bannerText}`
            );
          }
          crmStatusUpdateVerified = true;
        }
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `11b-dashboard-${vp.name}-crm-eventos.png`),
        fullPage: false,
      });
    }

    // Click Tab 3: Códigos QR Inteligentes por Sede
    const qrTabBtn = page
      .locator('[role="tab"]', { hasText: "Códigos QR Inteligentes" })
      .first();
    if ((await qrTabBtn.count()) > 0) {
      await qrTabBtn.click();
      await page.waitForTimeout(350);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `11c-dashboard-${vp.name}-qr-generator.png`),
        fullPage: false,
      });
    }

    report.routeAudits.push(
      await collectPageMetrics(page, "/dashboard/casa-brasa", vp.name)
    );

    // 5. Audit "/botanica-brunch" (Single-Location Demo Scenario: Home, Menu, Eventos, Dashboard)
    console.log(`[${vp.name}] Auditing /botanica-brunch (Single-Location Scenario)...`);
    await page.goto(`${BASE_URL}/botanica-brunch`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(450);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, `12-botanica-${vp.name}-single-location.png`),
      fullPage: true,
    });
    if (vp.name === "desktop") {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-home.png`),
        fullPage: false,
      });
      const botSedes = page.locator("#sedes");
      if ((await botSedes.count()) > 0) {
        await botSedes.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-sede-split.png`),
          fullPage: false,
        });
      }
    }
    report.routeAudits.push(
      await collectPageMetrics(page, "/botanica-brunch", vp.name)
    );

    // 5b. Audit "/botanica-brunch/menu"
    console.log(`[${vp.name}] Auditing /botanica-brunch/menu...`);
    await page.goto(`${BASE_URL}/botanica-brunch/menu`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(450);
    if (vp.name === "desktop") {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-menu.png`),
        fullPage: false,
      });
      // Add an item to open Light-First drawer
      const firstAddBtn = page.locator("article button", { hasText: "Mesa" }).first();
      if ((await firstAddBtn.count()) > 0) {
        await firstAddBtn.click();
        await page.waitForTimeout(300);
        const openDrawerBtn = page.locator("button", { hasText: "Mi Selección en Mesa" }).first();
        if ((await openDrawerBtn.count()) > 0) {
          await openDrawerBtn.click();
          await page.waitForTimeout(350);
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-menu-drawer.png`),
            fullPage: false,
          });
          await page
            .locator('[role="dialog"] button[aria-label*="Cerrar"]')
            .first()
            .evaluate((el) => el.click());
          await page.waitForTimeout(200);
        }
      }
    }
    report.routeAudits.push(
      await collectPageMetrics(page, "/botanica-brunch/menu", vp.name)
    );

    // 5c. Audit "/botanica-brunch/eventos" (Adaptive 2-column spaces & packages + Light-First form)
    console.log(`[${vp.name}] Auditing /botanica-brunch/eventos...`);
    await page.goto(`${BASE_URL}/botanica-brunch/eventos`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(450);
    if (vp.name === "desktop") {
      const spacesH2 = page.locator("h2", { hasText: "Nuestros Salones" }).first();
      if ((await spacesH2.count()) > 0) {
        await spacesH2.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
      }
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-eventos-spaces.png`),
        fullPage: false,
      });

      const pkgsH2 = page.locator("h2", { hasText: "Paquetes Comerciales" }).first();
      if ((await pkgsH2.count()) > 0) {
        await pkgsH2.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
      }
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-eventos-packages.png`),
        fullPage: false,
      });

      // Click "Elegir este paquete para cotizar" on Brunch package to verify auto-select of 'breakfast'
      const brunchPkgBtn = page.locator("button", { hasText: "Elegir este paquete" }).first();
      if ((await brunchPkgBtn.count()) > 0) {
        await brunchPkgBtn.click();
        await page.waitForTimeout(350);
      }

      const botForm = page.locator("#solicitud-cotizacion-eventos");
      if ((await botForm.count()) > 0) {
        await botForm.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
      }
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-eventos-form.png`),
        fullPage: false,
      });
    }
    report.routeAudits.push(
      await collectPageMetrics(page, "/botanica-brunch/eventos", vp.name)
    );

    // 5d. Audit "/dashboard/botanica-brunch" (Botanical Theme + Real QR ISO/IEC 18004)
    console.log(`[${vp.name}] Auditing /dashboard/botanica-brunch...`);
    await page.goto(`${BASE_URL}/dashboard/botanica-brunch`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(450);
    if (vp.name === "desktop") {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-dashboard.png`),
        fullPage: false,
      });
      const botQrTab = page.locator('[role="tab"]', { hasText: "Códigos QR" }).first();
      if ((await botQrTab.count()) > 0) {
        await botQrTab.click();
        await page.waitForTimeout(350);
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-dashboard-qr.png`),
          fullPage: false,
        });
      }
    }
    report.routeAudits.push(
      await collectPageMetrics(page, "/dashboard/botanica-brunch", vp.name)
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
        sanitizedGuestVal,
        deliveryOrderCode,
        crmStatusUpdateVerified,
      },
    };

    await context.close();
  }

  // Dedicated 820px Tablet Audit (Navbar & Adaptive 2-col Grids)
  console.log(`[tablet-820] Auditing /botanica-brunch, /botanica-brunch/menu, /botanica-brunch/eventos...`);
  const tabletCtx = await browser.newContext({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  const tabletPage = await tabletCtx.newPage();
  for (const route of ["/botanica-brunch", "/botanica-brunch/menu", "/botanica-brunch/eventos", "/casa-brasa"]) {
    await tabletPage.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
    await tabletPage.waitForTimeout(500);
    if (route === "/botanica-brunch") {
      await tabletPage.screenshot({
        path: path.join(SCREENSHOT_DIR, `iter6-after-botanica-tablet-820.png`),
        fullPage: false,
      });
    }
    report.routeAudits.push(await collectPageMetrics(tabletPage, route, "tablet-820"));
  }
  await tabletCtx.close();

  await browser.close();

  const reportPath = path.join(SCREENSHOT_DIR, "audit-telemetry.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Audit complete! Telemetry written to ${reportPath}`);
}

runAudit().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
