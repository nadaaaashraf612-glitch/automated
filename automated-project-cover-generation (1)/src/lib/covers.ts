import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import puppeteer, { type Browser } from "puppeteer";
import { db } from "@/db";
import { projects } from "@/db/schema";

const COVERS_DIR = path.join(process.cwd(), "public", "covers");
const NAV_TIMEOUT = 15000;
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };
const MOBILE_VIEWPORT = { width: 414, height: 896 };

function toAbsoluteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

async function ensureCoversDir() {
  await fs.mkdir(COVERS_DIR, { recursive: true });
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

interface ShotResult {
  buffer: Buffer;
}

const INTRO_KEYWORDS = [
  "تخطي",
  "ابدأ",
  "دخول",
  "متابعة",
  "استمرار",
  "التالي",
  "Skip",
  "Get Started",
  "Continue",
  "Start",
  "Enter",
  "Next",
];

// Best-effort dismissal of onboarding/splash screens that some apps show on
// first load, so the captured cover reflects the real product UI rather than
// a static intro slide. Safe no-op if nothing matches.
async function dismissIntroScreens(page: import("puppeteer").Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const clicked = await page.evaluate((keywords: string[]) => {
        const candidates = Array.from(
          document.querySelectorAll("button, a, [role='button'], [class*='skip'], [class*='next']")
        ) as HTMLElement[];
        const match = candidates.find((el) => {
          const text = (el.textContent || "").trim();
          return text.length > 0 && text.length < 30 && keywords.some((k) => text.includes(k));
        });
        if (match) {
          match.click();
          return true;
        }
        return false;
      }, INTRO_KEYWORDS);

      if (!clicked) break;
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } catch {
      break;
    }
  }
}

async function captureViewportShot(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  isApp: boolean
): Promise<ShotResult> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PUIUX-CoverBot"
    );

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: NAV_TIMEOUT,
    });

    const status = response?.status() ?? 0;
    if (status === 401 || status === 403) {
      throw new Error(`Access blocked (HTTP ${status}) — login or permission required`);
    }
    if (status >= 400) {
      throw new Error(`Page returned HTTP ${status}`);
    }

    // Let hero animations / web fonts settle before capturing.
    await new Promise((resolve) => setTimeout(resolve, isApp ? 2200 : 900));

    if (isApp) {
      // Apps often ship a splash/onboarding slide on first load — try to move
      // past it so the screenshot reflects the real product UI.
      await dismissIntroScreens(page);
    }

    const buffer = (await page.screenshot({ type: "png" })) as Buffer;
    return { buffer };
  } finally {
    await page.close();
  }
}

async function captureWithRetry(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  isApp = false
): Promise<ShotResult> {
  try {
    return await captureViewportShot(browser, url, viewport, isApp);
  } catch {
    // Single retry, as requested.
    return await captureViewportShot(browser, url, viewport, isApp);
  }
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function browserMockupHtml(screenshotBase64: string, displayUrl: string, w: number, h: number) {
  const chromeHeight = 54;
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; background:#0a0a0c; font-family: 'Manrope', Arial, sans-serif; }
  #frame { width:${w}px; height:${h}px; border-radius:18px; overflow:hidden; background:#0a0a0c;
    box-shadow: 0 0 0 1px rgba(139,92,246,0.25); }
  #chrome { height:${chromeHeight}px; width:100%; display:flex; align-items:center; gap:10px;
    padding:0 18px; background:linear-gradient(180deg,#19191d,#121214);
    border-bottom:1px solid rgba(139,92,246,0.18); }
  .dot { width:12px; height:12px; border-radius:50%; flex-shrink:0; }
  .dot.red { background:#ff5f57; } .dot.yellow { background:#febc2e; } .dot.green { background:#28c840; }
  #bar { flex:1; margin:0 14px; height:28px; border-radius:999px; background:rgba(255,255,255,0.06);
    border:1px solid rgba(196,181,253,0.18); display:flex; align-items:center; justify-content:center;
    color:rgba(245,245,240,0.75); font-size:13px; letter-spacing:0.02em; gap:8px; overflow:hidden; }
  #bar span.lock { opacity:0.6; }
  #bar span.url { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; direction:ltr; max-width:${w - 260}px; }
  #shot { width:${w}px; height:${h - chromeHeight}px; object-fit:cover; object-position:top center; display:block; }
</style></head>
<body>
  <div id="frame">
    <div id="chrome">
      <div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div>
      <div id="bar"><span class="lock">&#128274;</span><span class="url">${escapeHtml(displayUrl)}</span></div>
    </div>
    <img id="shot" src="data:image/png;base64,${screenshotBase64}" />
  </div>
</body></html>`;
}

function phoneMockupHtml(screenshotBase64: string, w: number, h: number) {
  const bezel = 16;
  const notchW = Math.round(w * 0.38);
  return `<!doctype html>
<html><head><meta charset="utf-8" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${w}px; height:${h}px; background:transparent; }
  #phone { width:${w}px; height:${h}px; border-radius:46px; background:#0a0a0c; padding:${bezel}px;
    box-shadow: 0 0 0 1px rgba(139,92,246,0.3), 0 30px 60px -20px rgba(139,92,246,0.35); position:relative; }
  #screen { width:100%; height:100%; border-radius:32px; overflow:hidden; position:relative; background:#000; }
  #screen img { width:100%; height:100%; object-fit:cover; object-position:top center; display:block; }
  #notch { position:absolute; top:${bezel}px; left:50%; transform:translateX(-50%); width:${notchW}px; height:22px;
    background:#0a0a0c; border-radius:0 0 16px 16px; z-index:2; }
</style></head>
<body>
  <div id="phone">
    <div id="screen"><img src="data:image/png;base64,${screenshotBase64}" /></div>
    <div id="notch"></div>
  </div>
</body></html>`;
}

async function renderHtmlToJpeg(
  browser: Browser,
  html: string,
  width: number,
  height: number
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1.5 });
    await page.setContent(html, { waitUntil: "load" });
    const buffer = (await page.screenshot({ type: "jpeg", quality: 90 })) as Buffer;
    return buffer;
  } finally {
    await page.close();
  }
}

export interface GenerateOptions {
  force?: boolean;
}

export interface GenerateResult {
  slug: string;
  status: "ok" | "failed" | "skipped";
  error?: string;
}

export async function generateCoverForProject(
  browser: Browser,
  project: typeof projects.$inferSelect,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  await ensureCoversDir();

  const desktopFile = path.join(COVERS_DIR, `${project.slug}.jpg`);
  const mobileFile = path.join(COVERS_DIR, `${project.slug}-mobile.jpg`);

  if (!options.force && project.previewStatus === "ok" && project.coverImage) {
    const exists = await fs
      .access(desktopFile)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      return { slug: project.slug, status: "skipped" };
    }
  }

  const absoluteUrl = toAbsoluteUrl(project.url);

  const isApp = project.category === "app";

  try {
    const desktopShot = await captureWithRetry(browser, absoluteUrl, DESKTOP_VIEWPORT, isApp);
    const desktopHtml = browserMockupHtml(
      desktopShot.buffer.toString("base64"),
      project.url,
      1600,
      1000
    );
    const desktopCover = await renderHtmlToJpeg(browser, desktopHtml, 1600, 1000);
    await fs.writeFile(desktopFile, desktopCover);

    let mobileCoverPath: string | null = null;
    if (isApp) {
      const mobileShot = await captureWithRetry(browser, absoluteUrl, MOBILE_VIEWPORT, true);
      const mobileHtml = phoneMockupHtml(mobileShot.buffer.toString("base64"), 460, 940);
      const mobileCover = await renderHtmlToJpeg(browser, mobileHtml, 460, 940);
      await fs.writeFile(mobileFile, mobileCover);
      mobileCoverPath = `/covers/${project.slug}-mobile.jpg?v=${Date.now()}`;
    }

    const version = Date.now();
    await db
      .update(projects)
      .set({
        coverImage: `/covers/${project.slug}.jpg?v=${version}`,
        coverImageMobile: mobileCoverPath,
        previewStatus: "ok",
        previewError: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));

    return { slug: project.slug, status: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(projects)
      .set({
        previewStatus: "failed",
        previewError: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id));
    return { slug: project.slug, status: "failed", error: message };
  }
}

export async function generateCovers(
  targetProjects: Array<typeof projects.$inferSelect>,
  options: GenerateOptions = {}
): Promise<GenerateResult[]> {
  const browser = await launchBrowser();
  const results: GenerateResult[] = [];
  try {
    // Process sequentially to stay gentle on memory/CPU and keep retries predictable.
    for (const project of targetProjects) {
      const result = await generateCoverForProject(browser, project, options);
      results.push(result);
    }
  } finally {
    await browser.close();
  }
  return results;
}
