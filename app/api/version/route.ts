// /api/version — padrao do control-plane: expoe o SHA do build para provar o que esta no ar.
// Le GIT_SHA do ambiente (injetado no build/runtime via EasyPanel Build Arguments). Sem auth, sem segredo.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ sha: process.env.GIT_SHA ?? "unknown" });
}
