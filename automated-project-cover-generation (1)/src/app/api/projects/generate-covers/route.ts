import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { generateCovers } from "@/lib/covers";

export const maxDuration = 300;

// POST /api/projects/generate-covers
// Body (optional): { slug?: string; force?: boolean }
// - No slug -> regenerates every project missing a cover (or all if force=true).
// - With slug -> regenerates a single project's cover only.
export async function POST(request: NextRequest) {
  let body: { slug?: string; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // no body provided — treat as "run for all missing covers"
  }

  const force = Boolean(body.force);

  try {
    if (body.slug) {
      const rows = await db.select().from(projects).where(eq(projects.slug, body.slug)).limit(1);
      const project = rows[0];
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      const [result] = await generateCovers([project], { force: true });
      return NextResponse.json({ results: [result] });
    }

    const all = await db.select().from(projects);
    const results = await generateCovers(all, { force });
    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
