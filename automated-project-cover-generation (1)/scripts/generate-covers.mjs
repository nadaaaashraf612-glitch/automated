// Bulk-generates real homepage screenshots (wrapped in a browser/phone mockup)
// for every project currently stored in the `projects` table, and writes the
// resulting cover image paths back to the database. Mirrors the logic used by
// POST /api/projects/generate-covers so results are identical whether this is
// run from the CLI or triggered from the running app.
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import puppeteer from "puppeteer";

const COVERS_DIR = path.join(process.cwd(), "public", "covers");
const NAV_TIMEOUT = 15000;
const DESKTOP_VIEWPORT = { width: 1920, height: 1080 };
const MOBILE_VIEWPORT = { width: 414, height: 896 };
const CONCURRENCY = 5;
const FORCE = process.argv.includes("--force");
const ONLY_ARG = process.argv.find((a) => a.startsWith("--only="));
const ONLY = ONLY_ARG ? new Set(ONLY_ARG.replace("--only=", "").split(",")) : null;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function toAbsoluteUrl(url) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function escapeHtml(input) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const INTRO_KEYWORDS = [
  "تخطي", "ابدأ", "دخول", "متابعة", "استمرار", "التالي",
  "Skip", "Get Started", "Continue", "Start", "Enter", "Next",
];

async function dismissIntroScreens(page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const clicked = await page.evaluate((keywords) => {
        const candidates = Array.from(
          document.querySelectorAll("button, a, [role='button'], [class*='skip'], [class*='next']")
        );
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
      await new Promise((r) => setTimeout(r, 1200));
    } catch {
      break;
    }
  }
}

async function captureViewportShot(browser, url, viewport, isApp) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 PUIUX-CoverBot"
    );
    const response = await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    const status = response ? response.status() : 0;
    if (status === 401 || status === 403) throw new Error(`Access blocked (HTTP ${status})`);
    if (status >= 400) throw new Error(`Page returned HTTP ${status}`);
    await new Promise((r) => setTimeout(r, isApp ? 2200 : 900));
    if (isApp) await dismissIntroScreens(page);
    return await page.screenshot({ type: "png" });
  } finally {
    await page.close();
  }
}

async function captureWithRetry(browser, url, viewport, isApp = false) {
  try {
    return await captureViewportShot(browser, url, viewport, isApp);
  } catch {
    return await captureViewportShot(browser, url, viewport, isApp);
  }
}

function browserMockupHtml(base64, displayUrl, w, h) {
  const chromeHeight = 54;
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:${w}px;height:${h}px;background:#0a0a0c;font-family:'Manrope',Arial,sans-serif;}
  #frame{width:${w}px;height:${h}px;border-radius:18px;overflow:hidden;background:#0a0a0c;box-shadow:0 0 0 1px rgba(139,92,246,0.25);}
  #chrome{height:${chromeHeight}px;width:100%;display:flex;align-items:center;gap:10px;padding:0 18px;background:linear-gradient(180deg,#19191d,#121214);border-bottom:1px solid rgba(139,92,246,0.18);}
  .dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
  .dot.red{background:#ff5f57;}.dot.yellow{background:#febc2e;}.dot.green{background:#28c840;}
  #bar{flex:1;margin:0 14px;height:28px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(196,181,253,0.18);display:flex;align-items:center;justify-content:center;color:rgba(245,245,240,0.75);font-size:13px;gap:8px;overflow:hidden;}
  #bar span.url{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:ltr;max-width:${w - 260}px;}
  #shot{width:${w}px;height:${h - chromeHeight}px;object-fit:cover;object-position:top center;display:block;}
  </style></head><body><div id="frame"><div id="chrome"><div class="dot red"></div><div class="dot yellow"></div><div class="dot green"></div><div id="bar"><span class="lock">&#128274;</span><span class="url">${escapeHtml(displayUrl)}</span></div></div><img id="shot" src="data:image/png;base64,${base64}" /></div></body></html>`;
}

function phoneMockupHtml(base64, w, h) {
  const bezel = 16;
  const notchW = Math.round(w * 0.38);
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{width:${w}px;height:${h}px;background:transparent;}
  #phone{width:${w}px;height:${h}px;border-radius:46px;background:#0a0a0c;padding:${bezel}px;box-shadow:0 0 0 1px rgba(139,92,246,0.3),0 30px 60px -20px rgba(139,92,246,0.35);position:relative;}
  #screen{width:100%;height:100%;border-radius:32px;overflow:hidden;position:relative;background:#000;}
  #screen img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;}
  #notch{position:absolute;top:${bezel}px;left:50%;transform:translateX(-50%);width:${notchW}px;height:22px;background:#0a0a0c;border-radius:0 0 16px 16px;z-index:2;}
  </style></head><body><div id="phone"><div id="screen"><img src="data:image/png;base64,${base64}" /></div><div id="notch"></div></div></body></html>`;
}

async function renderHtmlToJpeg(browser, html, width, height) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1.5 });
    await page.setContent(html, { waitUntil: "load" });
    return await page.screenshot({ type: "jpeg", quality: 90 });
  } finally {
    await page.close();
  }
}

async function processProject(browser, client, project) {
  await fs.mkdir(COVERS_DIR, { recursive: true });
  const desktopFile = path.join(COVERS_DIR, `${project.slug}.jpg`);
  const mobileFile = path.join(COVERS_DIR, `${project.slug}-mobile.jpg`);

  if (!FORCE && project.preview_status === "ok" && project.cover_image) {
    const exists = await fs.access(desktopFile).then(() => true).catch(() => false);
    if (exists) {
      console.log(`SKIP  ${project.slug}`);
      return;
    }
  }

  const absoluteUrl = toAbsoluteUrl(project.url);
  const isApp = project.category === "app";
  try {
    const desktopShot = await captureWithRetry(browser, absoluteUrl, DESKTOP_VIEWPORT, isApp);
    const desktopHtml = browserMockupHtml(desktopShot.toString("base64"), project.url, 1600, 1000);
    const desktopCover = await renderHtmlToJpeg(browser, desktopHtml, 1600, 1000);
    await fs.writeFile(desktopFile, desktopCover);

    let mobileCoverPath = null;
    if (isApp) {
      const mobileShot = await captureWithRetry(browser, absoluteUrl, MOBILE_VIEWPORT, true);
      const mobileHtml = phoneMockupHtml(mobileShot.toString("base64"), 460, 940);
      const mobileCover = await renderHtmlToJpeg(browser, mobileHtml, 460, 940);
      await fs.writeFile(mobileFile, mobileCover);
      mobileCoverPath = `/covers/${project.slug}-mobile.jpg?v=${Date.now()}`;
    }

    const version = Date.now();
    await client.query(
      `UPDATE projects SET cover_image=$1, cover_image_mobile=$2, preview_status='ok', preview_error=NULL, updated_at=now() WHERE id=$3`,
      [`/covers/${project.slug}.jpg?v=${version}`, mobileCoverPath, project.id]
    );
    console.log(`OK    ${project.slug}`);
  } catch (err) {
    await client.query(
      `UPDATE projects SET preview_status='failed', preview_error=$1, updated_at=now() WHERE id=$2`,
      [String(err.message || err).slice(0, 500), project.id]
    );
    console.log(`FAIL  ${project.slug} — ${err.message || err}`);
  }
}

async function run() {
  const client = await pool.connect();
  const { rows: allRows } = await client.query("SELECT * FROM projects ORDER BY sort_order ASC");
  client.release();
  const rows = ONLY ? allRows.filter((r) => ONLY.has(r.slug)) : allRows;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let cursor = 0;
  async function worker(workerClient) {
    while (cursor < rows.length) {
      const project = rows[cursor];
      cursor += 1;
      await processProject(browser, workerClient, project);
    }
  }

  try {
    const clients = await Promise.all(Array.from({ length: CONCURRENCY }, () => pool.connect()));
    await Promise.all(clients.map((c) => worker(c)));
    clients.forEach((c) => c.release());
  } finally {
    await browser.close();
    await pool.end();
  }
}

run()
  .then(() => console.log("Done."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
