import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";

export type ProjectRow = typeof projects.$inferSelect;

export async function listProjects(): Promise<ProjectRow[]> {
  return db.select().from(projects).orderBy(asc(projects.sortOrder));
}

export async function getProjectBySlug(slug: string): Promise<ProjectRow | undefined> {
  const rows = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return rows[0];
}
