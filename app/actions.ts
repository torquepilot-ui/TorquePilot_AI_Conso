"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { makeSession, readSession } from "../lib/session";
import {
  DB_PATH, USAGE_INBOX_DIR, USAGE_REPORTS_DIR,
  assignAiAccountToProject, createAiAccount, createProject, createUser,
  deleteAiAccount, deleteProject, deleteProjectAiSetup, deleteSavedUsageReport,
  estimateProjectUsage, importConnectorUsage, importHermesLocalUsage, importUsageInbox, resolveHermesProfileStateDbPath,
  updateAiAccount, updateProject, updateProjectAiSetup, verifyUser,
} from "../lib/db";
import { checkProviderConnection, type ProviderConnectionStatus } from "../lib/provider-api";

async function setSession(userId: number) {
  const jar = await cookies();
  jar.set("tp_session", makeSession(userId), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function currentUserId() {
  const jar = await cookies();
  return readSession(jar.get("tp_session")?.value);
}

export async function registerAction(formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!email || password.length < 8) redirect("/?error=Mot de passe minimum 8 caractères");
  try { const user = createUser(DB_PATH, email, password); await setSession(user.id); } catch (err) { console.error("[registerAction]", err); redirect("/?error=Compte déjà existant ou saisie invalide"); }
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const user = verifyUser(DB_PATH, String(formData.get("email") || ""), String(formData.get("password") || ""));
  if (!user) redirect("/?error=Connexion refusée");
  await setSession(user.id);
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete("tp_session");
  redirect("/");
}

export async function createProjectAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (name) { const project = createProject(DB_PATH, userId, name, description); revalidatePath("/"); redirect(`/?project=${project.id}`); }
  redirect("/");
}

export async function deleteProjectAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  try { deleteProject(DB_PATH, userId, Number(formData.get("projectId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteProjectAction]", err); redirect(`/?project=${formData.get("projectId") || ""}&error=Suppression projet refusée`); }
  redirect("/");
}

export async function updateProjectAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateProject(DB_PATH, userId, projectId, String(formData.get("name") || ""), String(formData.get("description") || ""));
    revalidatePath("/");
  } catch (err) { console.error("[updateProjectAction]", err); redirect(`/?project=${projectId}&error=Modification projet refusée`); }
  redirect(`/?project=${projectId}`);
}

export async function createAiAccountAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    createAiAccount(DB_PATH, userId, {
      providerId: Number(formData.get("providerId") || 0) || null,
      name: String(formData.get("name") || ""),
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      subscriptionName: String(formData.get("subscriptionName") || ""),
      monthlyCostEur: Number(formData.get("monthlyCostEur") || 0),
      notes: String(formData.get("notes") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[createAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Compte IA refusé`); }
  redirect(`/?project=${projectId || ""}`);
}

export async function updateAiAccountAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateAiAccount(DB_PATH, userId, Number(formData.get("accountId") || 0), {
      providerId: Number(formData.get("providerId") || 0) || null,
      name: String(formData.get("name") || ""),
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      subscriptionName: String(formData.get("subscriptionName") || ""),
      monthlyCostEur: Number(formData.get("monthlyCostEur") || 0),
      notes: String(formData.get("notes") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[updateAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Modification compte IA refusée`); }
  redirect(`/?project=${projectId || ""}`);
}

export async function deleteAiAccountAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try { deleteAiAccount(DB_PATH, userId, Number(formData.get("accountId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteAiAccountAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression compte IA refusée`); }
  redirect(`/?project=${projectId || ""}`);
}

export async function assignAiSetupAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    assignAiAccountToProject(DB_PATH, userId, {
      projectId,
      accountId: Number(formData.get("accountId") || 0),
      modelId: Number(formData.get("modelId") || 0) || null,
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      label: String(formData.get("label") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[assignAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}

export async function updateAiSetupAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    updateProjectAiSetup(DB_PATH, userId, Number(formData.get("setupId") || 0), {
      projectId,
      accountId: Number(formData.get("accountId") || 0),
      modelId: Number(formData.get("modelId") || 0) || null,
      connectionType: String(formData.get("connectionType") || "subscription") as any,
      label: String(formData.get("label") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[updateAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Modification affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}

export async function deleteAiSetupAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try { deleteProjectAiSetup(DB_PATH, userId, Number(formData.get("setupId") || 0)); revalidatePath("/"); }
  catch (err) { console.error("[deleteAiSetupAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression affectation IA refusée`); }
  redirect(`/?project=${projectId}`);
}

export async function estimateUsageAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    estimateProjectUsage(DB_PATH, userId, {
      projectId,
      setupId: Number(formData.get("setupId") || 0),
      label: String(formData.get("label") || ""),
      inputText: String(formData.get("inputText") || ""),
      outputText: String(formData.get("outputText") || ""),
      usedAt: String(formData.get("usedAt") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[estimateUsageAction]", err); redirect(`/?project=${projectId || ""}&error=Estimation refusée`); }
  redirect(`/?project=${projectId}`);
}

export async function importUsageAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    importConnectorUsage(DB_PATH, userId, {
      connector: String(formData.get("connector") || "generic") as any,
      projectId,
      setupId: Number(formData.get("setupId") || 0),
      sourceName: String(formData.get("sourceName") || ""),
      rawExport: String(formData.get("rawExport") || ""),
      usedAt: String(formData.get("usedAt") || ""),
    });
    revalidatePath("/");
  } catch (err) { console.error("[importUsageAction]", err); redirect(`/?project=${projectId || ""}&error=Import automatique refusé`); }
  redirect(`/?project=${projectId}`);
}

export async function importInboxAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    importUsageInbox(DB_PATH, userId, { rootDir: USAGE_INBOX_DIR, projectId, setupId: Number(formData.get("setupId") || 0), usedAt: String(formData.get("usedAt") || "") });
    revalidatePath("/");
  } catch (err) { console.error("[importInboxAction]", err); redirect(`/?project=${projectId || ""}&error=Import dossier refusé`); }
  redirect(`/?project=${projectId}`);
}


export async function importHermesLocalAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    const profileName = String(formData.get("profileName") || "default");
    importHermesLocalUsage(DB_PATH, userId, {
      projectId,
      setupId: Number(formData.get("setupId") || 0) || null,
      hermesDbPath: resolveHermesProfileStateDbPath(profileName),
      profileName,
    });
    revalidatePath("/");
  } catch (err) { console.error("[importHermesLocalAction]", err); redirect(`/?project=${projectId || ""}&error=Import HERMES local refusé`); }
  redirect(`/?project=${projectId}`);
}

export async function deleteSavedReportAction(formData: FormData) {
  const userId = await currentUserId();
  if (!userId) redirect("/");
  const projectId = Number(formData.get("projectId") || 0);
  try {
    deleteSavedUsageReport(USAGE_REPORTS_DIR, String(formData.get("fileName") || ""));
    revalidatePath("/");
  } catch (err) { console.error("[deleteSavedReportAction]", err); redirect(`/?project=${projectId || ""}&error=Suppression rapport refusée`); }
  redirect(`/?project=${projectId || ""}`);
}

export async function getOpenAiStatusAction(): Promise<ProviderConnectionStatus> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, provider: "OpenAI", status: "error", message: "Non authentifié" };
  return checkProviderConnection("OpenAI");
}
