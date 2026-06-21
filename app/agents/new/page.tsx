import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import NewAgentForm from "./NewAgentForm";

export const dynamic = "force-dynamic";

export default async function NewAgentPage() {
  const session = await auth();
  const userEmail = (session?.user?.email ?? "").toLowerCase();
  if (!userEmail) redirect("/");

  return <NewAgentForm userEmail={userEmail} />;
}
