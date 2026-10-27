import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";

// Projects table — powers the "Projects" section of the PUIUX profile.
// Each row corresponds to one real project link. The cover image shown on the
// website/app cards and on the project detail page is a real screenshot of the
// project's homepage (or best page for apps), composed inside an elegant
// browser/phone mockup frame and cached as a static file under /public/covers.
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  url: text("url").notNull(),
  category: varchar("category", { length: 20 }).notNull(), // "website" | "app"
  groupEn: text("group_en"),
  groupAr: text("group_ar"),
  note: text("note"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Desktop browser-mockup cover (used everywhere by default)
  coverImage: text("cover_image"),
  // Extra mobile phone-mockup cover, generated for "app" category projects
  coverImageMobile: text("cover_image_mobile"),
  previewStatus: varchar("preview_status", { length: 20 }).notNull().default("pending"), // pending | ok | failed
  previewError: text("preview_error"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
