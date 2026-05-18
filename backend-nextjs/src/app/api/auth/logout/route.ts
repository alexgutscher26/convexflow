import { NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/mongodb";
import { JWT_SECRET, JWT_ALGO, TokenPayload } from "@/lib/auth";

const LogoutSchema = z.object({
  refresh_token: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = LogoutSchema.safeParse(body);
    
    if (result.success) {
      const { refresh_token } = result.data;
      try {
        const payload = jwt.verify(refresh_token, JWT_SECRET, { algorithms: [JWT_ALGO] }) as TokenPayload;
        if (payload.type === "refresh") {
          const jti = payload.jti;
          const db = await getDb();
          await db.collection("refresh_tokens").updateOne(
            { id: jti },
            { $set: { revoked: true } }
          );
        }
      } catch (err) {
        // Suppress verification errors during logout for smooth UX
      }
    }
  } catch (err) {
    // Suppress body parsing errors as well
  }
  
  return NextResponse.json({ ok: true });
}
