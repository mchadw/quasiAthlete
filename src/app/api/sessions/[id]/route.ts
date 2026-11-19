import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getFullDashboardState } from "@/db/queries";
import { sessionLogs } from "@/db/schema";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const { id } = await context.params;
  if (!id || id.length > 80) {
    return jsonPrivate({ error: "Invalid session id" }, 400);
  }

  const db = await getDb();
  await db
    .delete(sessionLogs)
    .where(and(eq(sessionLogs.id, id), eq(sessionLogs.ownerSub, viewer.ownerSub)));

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state);
}
