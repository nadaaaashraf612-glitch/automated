import { listProjects } from "@/db/queries";
import Profile from "@/components/Profile";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await listProjects();
  return <Profile projects={projects} />;
}
