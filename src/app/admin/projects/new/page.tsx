import { requireAdmin } from "@/lib/admin";
import ProjectForm from "../ProjectForm";

export default async function NewProjectPage() {
  await requireAdmin();
  return <ProjectForm />;
}
