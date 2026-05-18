import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { hashPassword, createAccessToken, createRefreshToken } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(128),
  name: z.string().min(1).max(80),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = RegisterSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json(
        { detail: result.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(", ") },
        { status: 400 }
      );
    }
    
    const { email, password, name } = result.data;
    const lowerEmail = email.toLowerCase();
    
    const db = await getDb();
    const existing = await db.collection("users").findOne({ email: lowerEmail });
    if (existing) {
      return NextResponse.json({ detail: "Email already registered" }, { status: 400 });
    }
    
    const userId = uuidv4();
    const passwordHash = await hashPassword(password);
    
    const userDoc = {
      id: userId,
      email: lowerEmail,
      name: name,
      password_hash: passwordHash,
      created_at: new Date().toISOString(),
      github_pat: "",
    };
    
    await db.collection("users").insertOne(userDoc);
    
    const safeUser = {
      id: userId,
      email: lowerEmail,
      name: name,
    };
    
    const accessToken = createAccessToken(userId);
    const refreshToken = await createRefreshToken(userId);
    
    return NextResponse.json({
      token: accessToken,
      refresh_token: refreshToken,
      user: safeUser,
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Internal server error" }, { status: 500 });
  }
}
