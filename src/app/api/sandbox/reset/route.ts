import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getFullDashboardState } from "@/db/queries";
import { athletes } from "@/db/schema";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const db = await getDb();
  await db.delete(athletes).where(eq(athletes.ownerSub, viewer.ownerSub));

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate(state);
}
