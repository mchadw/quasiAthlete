import { getDbEngineMode } from "@/db";
import { getFullDashboardState } from "@/db/queries";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof Response) return viewer;

  const state = await getFullDashboardState(viewer.ownerSub);
  return jsonPrivate({
    viewer: {
      label: viewer.viewerLabel,
      kind: viewer.viewerKind,
      isSimulated: viewer.isSimulated,
    },
    dbEngine: getDbEngineMode(),
    ...state,
  });
}
