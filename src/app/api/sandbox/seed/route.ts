import { seedSandboxForOwner } from "@/db/queries";
import { sandboxSeedSchema } from "@/domain/schemas";
import { jsonPrivate, requireViewer } from "@/lib/request-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const viewer = await requireViewer(request, { mutating: true });
  if (viewer instanceof Response) return viewer;

  const rawBody = await request.json().catch(() => null);
  const parsed = sandboxSeedSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonPrivate({ error: "Invalid sandbox preset", details: parsed.error.flatten() }, 400);
  }

  const state = await seedSandboxForOwner({
    ownerSub: viewer.ownerSub,
    mainSport: parsed.data.mainSport,
    trackBranch: parsed.data.trackBranch,
    scenario: parsed.data.scenario,
  });

  return jsonPrivate(state, 200);
}
