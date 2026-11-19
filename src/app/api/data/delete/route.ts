import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { athletes } from "@/db/schema";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const db = await getDb();
  // ON DELETE CASCADE clears session_logs, benchmarks, and consent_audit_logs for this owner only
  await db.delete(athletes).where(eq(athletes.ownerSub, viewer.ownerSub));

  return jsonPrivate({
    deleted: true,
    deletedAt: new Date().toISOString(),
    note: "All personal athlete records, sessions, benchmarks, and consent logs have been permanently deleted.",
  });
}
