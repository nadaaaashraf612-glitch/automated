// Seeds the `projects` table from the real project list used across the PUIUX
// profile (the same list that lives in src/i18n/content.ts + the "signature
// collaborations" list). Safe to re-run: it upserts by slug and never touches
// cover_image / preview_status of rows that already have a generated cover.
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Main work list (title/url/category), EN + AR, in the exact order shown on
// the website. Source: src/i18n/content.ts
const mainEn = [
  { title: "Green Dimensions", url: "puiux.org/green_dinemtions/", category: "website" },
  { title: "AL-Othaim", url: "othaim.puiux.org", category: "website" },
  { title: "Nawan", url: "nawan.co/ar", category: "website" },
  { title: "Riyadati", url: "riyadati.puiux.org", category: "website" },
  { title: "Fawq", url: "fawq.puiux.org", category: "website" },
  { title: "Bdaya", url: "bdaya.puiux.org", category: "website" },
  { title: "Ghaim", url: "ghiam.puiux.org/ar/", category: "website" },
  { title: "Drizoro", url: "drizoro.puiux.org", category: "website" },
  { title: "Rosokh", url: "rosokh.org.sa", category: "website" },
  { title: "Go Ahead", url: "goahead.puiux.org", category: "website" },
  { title: "Ahbahgirls", url: "a7bahgirls.com", category: "website" },
  { title: "Al-Malhim", url: "almalhim.com/ar", category: "website" },
  { title: "SKY", url: "skys.sa/ar", category: "website" },
  { title: "Al-Bir Charity Society — Yanbu", url: "beryanbu.org.sa", category: "website" },
  { title: "Al-Bir Charity Society — Al-Ras", url: "per-alras.org.sa", category: "website" },
  { title: "Merowe", url: "merowe.co", category: "website" },
  { title: "Iran Hajj Pilgrims Mutawifs", url: "ipmc.puiux.org/ar", category: "website" },
  { title: "Manasek", url: "manasek.puiux.org/en", category: "website" },
  { title: "A PLUS", url: "aplus.puiux.org", category: "website" },
  { title: "AMS", url: "ams.puiux.org", category: "website" },
  { title: "Sana", url: "puiux.org/sana/", category: "website" },
  { title: "Saudi Electronic University", url: "seu.puiux.org", category: "website" },
  { title: "GTEL", url: "gtel.puiux.org", category: "website" },
  { title: "Sfoof App", url: "app-1-eta-ruddy.vercel.app", category: "app" },
  { title: "AL-Ezbah App", url: "azbah-preview.vercel.app", category: "app" },
  { title: "My Coach App", url: "mycoach-1ce80b56.puiux.live", category: "app" },
  { title: "Ithraa Al-Tafawoq App", url: "ithraa-eltafawoq-app.vercel.app", category: "app" },
];

const mainAr = [
  "الأبعاد الخضراء", "العثيم", "ناوان", "رياضتى", "فوق", "بداية", "غيم", "درايزورو",
  "رسوخ", "جو أهيد", "بنات الأحبة", "أل ملحم", "سكاى", "جمعية البر بينبع",
  "جمعية البر الأهلية بالرس", "مروى", "مطوفى حجاج ايران", "مناسك المشاعر", "A+", "AMS",
  "سنا", "الجامعة الالكترونية السعودية", "GTEL", "تطبيق صفوف", "تطبيق العزبة",
  "تطبيق ماى كوتش", "تطبيق اثراء التفوق",
];

const main = mainEn.map((p, i) => ({ ...p, titleAr: mainAr[i] }));

// Signature collaborations list. Source: src/utils/projectVisuals.ts
const signature = [
  { titleAr: "جمعية البر بينبع", titleEn: "Al-Bir Society — Yanbu", url: "beryanbu.org.sa", groupAr: "الأثر المجتمعي والخيري", groupEn: "Community & Charity Impact", device: "browser" },
  { titleAr: "جمعية التنمية الأهلية بعنيزة", titleEn: "National Community Development — Onaizah", url: "ncd-sa.com", groupAr: "الأثر المجتمعي والخيري", groupEn: "Community & Charity Impact", device: "browser" },
  { titleAr: "الجمعية الخيرية لتحفيظ القرآن الكريم", titleEn: "Quran Memorization Charity Association", url: "charity.puiux.org/ar/", groupAr: "الأثر المجتمعي والخيري", groupEn: "Community & Charity Impact", device: "browser" },
  { titleAr: "هيلث كوميونيتي", titleEn: "Health Community", url: "healthcommunity.sa", groupAr: "الصحة والسفر ونمط الحياة", groupEn: "Health, Travel & Lifestyle", device: "mobile" },
  { titleAr: "سكايز لحجوزات الفنادق", titleEn: "SKYS Hotel Booking", url: "skys.sa/en", groupAr: "الصحة والسفر ونمط الحياة", groupEn: "Health, Travel & Lifestyle", device: "browser" },
  { titleAr: "هامبرجيني", titleEn: "Hamburgini", url: "front.puiux.org/Hamburgini/index.php", groupAr: "الصحة والسفر ونمط الحياة", groupEn: "Health, Travel & Lifestyle", device: "browser" },
  { titleAr: "أبو سرهد القابضة", titleEn: "Abu Sarhad Holding", url: "abusarhadhc.sa", groupAr: "القابضات والاستثمار", groupEn: "Holdings & Investment", device: "browser" },
  { titleAr: "مباني الجزيرة القابضة", titleEn: "Mabani Aljazeera Holding", url: "mahg.com.sa", groupAr: "القابضات والاستثمار", groupEn: "Holdings & Investment", device: "browser" },
  { titleAr: "مؤسسة محمد بن عبدالعزيز آل سعود", titleEn: "Mohammed Al Saud Foundation", url: "mfoundm.com", groupAr: "القابضات والاستثمار", groupEn: "Holdings & Investment", device: "browser" },
  { titleAr: "احتزم", titleEn: "Ehtazem", url: "ehtazem.com", groupAr: "العقار والحرفية الفاخرة", groupEn: "Real Estate & Premium Craft", device: "browser" },
  { titleAr: "طراز العربية للتطوير العقاري", titleEn: "Tiraz Al-Arabia", url: "tiraz.com.sa", groupAr: "العقار والحرفية الفاخرة", groupEn: "Real Estate & Premium Craft", device: "browser" },
  { titleAr: "فيجن المتحدة للصناعة", titleEn: "United Vision Industry (Doors)", url: "uvi.sa", groupAr: "العقار والحرفية الفاخرة", groupEn: "Real Estate & Premium Craft", device: "browser" },
  { titleAr: "إيفينتا لتنظيم الفعاليات", titleEn: "Eventa Events & Exhibitions", url: "eventa.com.sa", groupAr: "منصات تقنية ومبتكرة", groupEn: "Tech Platforms & Innovation", device: "browser" },
  { titleAr: "نموذج تفاعلي — Figma Sites", titleEn: "Interactive Prototype — Figma Sites", url: "parse-create-00055751.figma.site", groupAr: "منصات تقنية ومبتكرة", groupEn: "Tech Platforms & Innovation", device: "browser" },
  { titleAr: "منصة تجريبية — eSIM", titleEn: "PUIUX Dev — eSIM Marketplace", url: "dev.puiux.org", groupAr: "منصات تقنية ومبتكرة", groupEn: "Tech Platforms & Innovation", device: "mobile" },
];

function normalizeUrl(url) {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function slugify(text) {
  return text
    .toString()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function main_() {
  const merged = main.map((p) => ({
    titleEn: p.title,
    titleAr: p.titleAr,
    url: p.url,
    category: p.category,
    groupEn: null,
    groupAr: null,
    note: null,
  }));

  const byUrl = new Map(merged.map((p) => [normalizeUrl(p.url), p]));

  for (const s of signature) {
    const key = normalizeUrl(s.url);
    const existing = byUrl.get(key);
    if (existing) {
      existing.groupEn = s.groupEn;
      existing.groupAr = s.groupAr;
    } else {
      const entry = {
        titleEn: s.titleEn,
        titleAr: s.titleAr,
        url: s.url,
        category: s.device === "mobile" ? "app" : "website",
        groupEn: s.groupEn,
        groupAr: s.groupAr,
        note: null,
      };
      merged.push(entry);
      byUrl.set(key, entry);
    }
  }

  const usedSlugs = new Set();
  merged.forEach((p, i) => {
    let base = slugify(p.titleEn) || slugify(normalizeUrl(p.url)) || `project-${i}`;
    let slug = base;
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    usedSlugs.add(slug);
    p.slug = slug;
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < merged.length; i += 1) {
      const p = merged[i];
      await client.query(
        `INSERT INTO projects (slug, title_en, title_ar, url, category, group_en, group_ar, note, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (slug) DO UPDATE SET
           title_en = EXCLUDED.title_en,
           title_ar = EXCLUDED.title_ar,
           url = EXCLUDED.url,
           category = EXCLUDED.category,
           group_en = EXCLUDED.group_en,
           group_ar = EXCLUDED.group_ar,
           sort_order = EXCLUDED.sort_order`,
        [p.slug, p.titleEn, p.titleAr, p.url, p.category, p.groupEn, p.groupAr, p.note, i]
      );
    }
    await client.query("COMMIT");
    console.log(`Seeded ${merged.length} projects.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main_().catch((err) => {
  console.error(err);
  process.exit(1);
});
