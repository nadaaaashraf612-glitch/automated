"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "../utils/cn";

interface ProjectCoverProps {
  slug: string;
  coverImage: string | null;
  previewStatus: string;
  title: string;
  lang: "ar" | "en";
  className?: string;
  imgClassName?: string;
}

/**
 * Renders the real homepage screenshot (already composed inside a browser
 * mockup frame server-side) for a project. Falls back to an elegant
 * "Preview unavailable" placeholder with a retry action when the target
 * site could not be captured (down, blocked, requires login, etc.).
 */
export function ProjectCover({
  slug,
  coverImage,
  previewStatus,
  title,
  lang,
  className,
  imgClassName,
}: ProjectCoverProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(previewStatus);
  const [localCover, setLocalCover] = useState(coverImage);

  const showFallback = !localCover || localStatus === "failed";

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch("/api/projects/generate-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      const result = data?.results?.[0];
      if (result?.status === "ok") {
        router.refresh();
        setLocalStatus("ok");
      } else {
        setLocalStatus("failed");
      }
    } catch {
      setLocalStatus("failed");
    } finally {
      setLoading(false);
    }
  }

  if (showFallback) {
    return (
      <div
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#141418] to-[#0a0a0c] px-6 text-center",
          className
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3l18 18M10.5 10.7A3 3 0 0012 15a3 3 0 002.6-1.5M6.3 6.4C4 8 2.5 10 1.8 12c1.6 4 5.6 7 10.2 7 1.7 0 3.3-.4 4.7-1.1M9.9 4.2A10.8 10.8 0 0112 4c4.6 0 8.6 3 10.2 7-.5 1.2-1.1 2.3-2 3.3" />
          </svg>
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
          {lang === "ar" ? "المعاينة غير متاحة" : "Preview unavailable"}
        </p>
        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-violet-soft)]/40 bg-white/5 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-violet-soft)] transition hover:border-[var(--color-violet)] hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? (lang === "ar" ? "جارٍ إعادة المحاولة…" : "Retrying…") : lang === "ar" ? "إعادة المحاولة" : "Retry"}
        </button>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={localCover ?? undefined}
      alt={title}
      loading="lazy"
      className={cn("h-full w-full object-cover object-top", imgClassName)}
    />
  );
}
