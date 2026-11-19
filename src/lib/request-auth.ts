import { requireIdentity, type VerifiedIdentity } from "../../cursor/identity";

export interface AuthenticatedViewer {
  ownerSub: string;
  viewerLabel: string;
  viewerKind: VerifiedIdentity["kind"];
  isSimulated: boolean;
}

/**
 * Verifies the caller via Cursor App Identity (or local simulated dev viewer when CURSOR_APP_ID is unset)
 * and enforces same-origin protection on state-changing HTTP methods.
 */
export async function requireViewer(
  request: Request,
  options?: { mutating?: boolean },
): Promise<AuthenticatedViewer | Response> {
  if (options?.mutating) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") {
      return Response.json(
        { error: "Cross-site state-changing request rejected." },
        { status: 403, headers: { "cache-control": "private, no-store" } },
      );
    }

    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          return Response.json(
            { error: "Origin mismatch on mutating request." },
            { status: 403, headers: { "cache-control": "private, no-store" } },
          );
        }
      } catch {
        return Response.json(
          { error: "Malformed Origin header." },
          { status: 403, headers: { "cache-control": "private, no-store" } },
        );
      }
    }
  }

  const identity = await requireIdentity(request);
  if (identity instanceof Response) {
    return identity;
  }

  const viewerLabel =
    identity.kind === "person"
      ? identity.name || identity.email || "Signed-in Athlete"
      : `${identity.name || "API Key"} (key)`;

  return {
    ownerSub: identity.stage === "preview" ? `preview:${identity.sub}` : identity.sub,
    viewerLabel,
    viewerKind: identity.kind,
    isSimulated: identity.simulated,
  };
}

/**
 * Helper for returning JSON responses that must never be cached across viewers.
 */
export function jsonPrivate(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
    },
  });
}
