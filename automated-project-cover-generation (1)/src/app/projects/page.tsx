import { listProjects } from "@/db/queries";
import ProjectsListClient from "@/components/ProjectsListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "PUIUX — كل المشاريع | All Projects",
};

export default async function ProjectsPage() {
  const projects = await listProjects();
  return <ProjectsListClient projects={projects} />;
}
