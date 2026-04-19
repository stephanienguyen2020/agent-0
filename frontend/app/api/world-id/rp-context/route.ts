import { signRequest } from "@worldcoin/idkit-core/signing";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = process.env.WORLD_ID_RP_SIGNING_KEY;
  const rpId = process.env.WORLD_ID_RP_ID;
  if (!key || !rpId) {
    return NextResponse.json(
      { error: "Set WORLD_ID_RP_SIGNING_KEY and WORLD_ID_RP_ID (server env) for IDKit v4." },
      { status: 501 },
    );
  }

  let action = process.env.NEXT_PUBLIC_WORLD_ID_ACTION || "register-executor";
  try {
    const body = await req.json();
    if (typeof body?.action === "string") action = body.action;
  } catch {
    /* empty body */
  }

  const sig = signRequest({ signingKeyHex: key, action, ttl: 300 });
  return NextResponse.json({
    rp_id: rpId,
    nonce: sig.nonce,
    created_at: sig.createdAt,
    expires_at: sig.expiresAt,
    signature: sig.sig,
  });
}
