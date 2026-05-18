import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { verifyPassword, createAccessToken, createRefreshToken } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = LoginSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { email, password } = result.data;
    const lowerEmail = email.toLowerCase();
    
    // Print credentials received for debugging
    console.log(`DEBUG LOGIN: email=${JSON.stringify(lowerEmail)}, password=${JSON.stringify(password)}`);
    
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: lowerEmail });
    
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }
    
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    
    const accessToken = createAccessToken(user.id);
    const refreshToken = await createRefreshToken(user.id);
    
    return NextResponse.json({
      token: accessToken,
      refresh_token: refreshToken,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status: 500 });
  }
}
