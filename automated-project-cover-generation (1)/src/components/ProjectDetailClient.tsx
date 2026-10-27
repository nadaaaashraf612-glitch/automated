"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LanguageProvider, useLanguage } from "../i18n/LanguageContext";
import { Logo } from "./ui";
import { GlobeIcon, DeviceIcon, LinkIcon } from "./icons";
import { ProjectCover } from "./ProjectCover";
import type { ProjectRow } from "@/db/queries";

function DetailBody({ project }: { project: ProjectRow }) {
  const { lang, toggleLang, dir } = useLanguage();
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const title = lang === "ar" ? project.titleAr : project.titleEn;
  const href = project.url.startsWith("http") ? project.url : `https://${project.url}`;
  const CategoryIcon = project.category === "app" ? DeviceIcon : GlobeIcon;
  const categoryLabel =
    project.category === "app" ? (lang === "ar" ? "تطبيق" : "App") : lang === "ar" ? "موقع" : "Website";
  const group = lang === "ar" ? project.groupAr : project.groupEn;

  async function handleUpdatePreview() {
    setUpdating(true);
    setMessage(null);
    try {
      const res = await fetch("/api/projects/generate-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: project.slug, force: true }),
      });
      const data = await res.json();
      const result = data?.results?.[0];
      if (result?.status === "ok") {
        setMessage(lang === "ar" ? "تم تحديث صورة المعاينة بنجاح." : "Preview image updated successfully.");
        router.refresh();
      } else {
        setMessage(
          lang === "ar"
            ? "تعذّر تحديث المعاينة. قد يكون الرابط غير متاح حاليًا."
            : "Could not update the preview. The link may currently be unavailable."
        );
      }
    } catch {
      setMessage(lang === "ar" ? "حدث خطأ أثناء تحديث المعاينة." : "Something went wrong while updating the preview.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div dir={dir} className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/80 px-6 py-4 backdrop-blur-xl sm:px-10 lg:px-16">
        <Link href="/projects" className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:text-white">
          <span>{dir === "rtl" ? "→" : "←"}</span>
          {lang === "ar" ? "كل المشاريع" : "All projects"}
        </Link>
        <Logo tone="dark" />
        <button
          type="button"
          onClick={toggleLang}
          className="rounded-full border border-white/20 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:border-[var(--color-violet)] hover:text-white"
        >
          {lang === "ar" ? "EN" : "AR"}
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16 sm:px-10 lg:px-16">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-[var(--color-gold-soft)]">
            <CategoryIcon className="h-3 w-3" />
            {categoryLabel}
          </span>
          {group && (
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
              {group}
            </span>
          )}
        </div>

        <h1 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">{title}</h1>

        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="mt-4 inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-[var(--color-gold-soft)]"
        >
          {project.url}
          <LinkIcon className="h-3.5 w-3.5" />
        </a>

        <div className={`mt-10 grid grid-cols-1 gap-8 ${project.category === "app" ? "lg:grid-cols-[1.4fr_0.6fr]" : ""}`}>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
            <div className="relative aspect-[16/10] w-full overflow-hidden">
              <ProjectCover
                slug={project.slug}
                coverImage={project.coverImage}
                previewStatus={project.previewStatus}
                title={title}
                lang={lang}
              />
            </div>
            <p className="px-6 py-4 text-center text-[11px] uppercase tracking-[0.2em] text-white/35">
              {lang === "ar" ? "موكب سطح المكتب" : "Desktop mockup"}
            </p>
          </div>

          {project.category === "app" && (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">
              <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden p-4">
                {project.coverImageMobile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.coverImageMobile}
                    alt={`${title} — mobile`}
                    className="h-full w-full rounded-[28px] object-cover object-top"
                  />
                ) : (
                  <ProjectCover
                    slug={project.slug}
                    coverImage={project.coverImage}
                    previewStatus={project.previewStatus}
                    title={title}
                    lang={lang}
                  />
                )}
              </div>
              <p className="px-6 py-4 text-center text-[11px] uppercase tracking-[0.2em] text-white/35">
                {lang === "ar" ? "موكب الموبايل" : "Mobile mockup"}
              </p>
            </div>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleUpdatePreview}
            disabled={updating}
            className="group inline-flex items-center gap-3 rounded-full border border-white/25 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:border-[var(--color-violet)] hover:bg-white hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updating ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
              </svg>
            )}
            {lang === "ar" ? "تحديث صورة المعاينة" : "Refresh preview image"}
          </button>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition hover:border-white/40 hover:text-white"
          >
            {lang === "ar" ? "زيارة الموقع" : "Visit live site"}
            <LinkIcon className="h-3.5 w-3.5" />
          </a>
          {message && <p className="text-xs text-white/55">{message}</p>}
        </div>

        {project.previewStatus === "failed" && project.previewError && (
          <p dir="ltr" className="mt-4 max-w-xl text-[11px] leading-relaxed text-white/35">
            {project.previewError}
          </p>
        )}
      </main>
    </div>
  );
}

export default function ProjectDetailClient({ project }: { project: ProjectRow }) {
  return (
    <LanguageProvider>
      <DetailBody project={project} />
    </LanguageProvider>
  );
}
