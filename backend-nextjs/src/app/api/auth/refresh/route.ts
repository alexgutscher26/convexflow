import { NextResponse } from "next/server";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/mongodb";
import { JWT_SECRET, JWT_REFRESH_SECRET, JWT_ALGO, createAccessToken, createRefreshToken, TokenPayload } from "@/lib/auth";

const RefreshSchema = z.object({
  refresh_token: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = RefreshSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { refresh_token } = result.data;
    let payload: TokenPayload;
    
    try {
      payload = jwt.verify(refresh_token, JWT_REFRESH_SECRET, { algorithms: [JWT_ALGO] }) as TokenPayload;
      if (payload.type !== "refresh") {
        return NextResponse.json({ detail: "Invalid token type" }, { status: 401 });
      }
    } catch (err) {
      return NextResponse.json({ detail: "Invalid refresh token" }, { status: 401 });
    }
    
    const jti = payload.jti;
    const userId = payload.sub;
    
    const db = await getDb();
    const tokenDoc = await db.collection("refresh_tokens").findOne({ id: jti });
    
    if (!tokenDoc) {
      return NextResponse.json({ detail: "Refresh token not found" }, { status: 401 });
    }
    
    if (tokenDoc.revoked) {
      // Suspected reuse attack: revoke all tokens for this user!
      console.warn(`Suspected refresh token reuse attack for user ${userId}! Revoking all tokens.`);
      await db.collection("refresh_tokens").updateMany(
        { user_id: userId },
        { $set: { revoked: true } }
      );
      return NextResponse.json({ detail: "Token revoked" }, { status: 401 });
    }
    
    // Rotate token: revoke current and issue a new one
    await db.collection("refresh_tokens").updateOne(
      { id: jti },
      { $set: { revoked: true } }
    );
    
    const user = await db.collection("users").findOne(
      { id: userId },
      { projection: { _id: 0, password_hash: 0 } }
    );
    
    if (!user) {
      return NextResponse.json({ detail: "User not found" }, { status: 401 });
    }
    
    const newAccess = createAccessToken(userId);
    const newRefresh = await createRefreshToken(userId);
    
    return NextResponse.json({
      token: newAccess,
      refresh_token: newRefresh,
      user: user,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status: 500 });
  }
}
