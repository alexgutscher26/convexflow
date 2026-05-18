import jwt from "jsonwebtoken";
import { getDb } from "./mongodb";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    return false;
  }
}


export const JWT_SECRET = process.env.JWT_SECRET || "replace_me_with_a_long_random_string";
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || JWT_SECRET;
export const JWT_ALGO = (process.env.JWT_ALGORITHM || "HS256") as jwt.Algorithm;

export interface TokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  type: "access" | "refresh";
}

export function createAccessToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const expiryMinutes = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "15", 10);
  const payload: TokenPayload = {
    sub: userId,
    jti: uuidv4(),
    iat: now,
    exp: now + expiryMinutes * 60,
    type: "access",
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGO });
}

export async function createRefreshToken(userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiryDays = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || "30", 10);
  const jti = uuidv4();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const payload: TokenPayload = {
    sub: userId,
    jti: jti,
    iat: now,
    exp: now + expiryDays * 24 * 60 * 60,
    type: "refresh",
  };

  const db = await getDb();
  await db.collection("refresh_tokens").insertOne({
    id: jti,
    user_id: userId,
    expires_at: expiresAt,
    revoked: false,
    created_at: new Date().toISOString(),
  });

  return jwt.sign(payload, JWT_REFRESH_SECRET, { algorithm: JWT_ALGO });
}

export async function getCurrentUser(req: Request): Promise<any> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing token");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new Error("Invalid token format");
  }

  const token = parts[1];
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGO] }) as TokenPayload;
  } catch (err) {
    throw new Error("Invalid token");
  }

  if (payload.type !== "access") {
    throw new Error("Invalid token type");
  }

  const db = await getDb();
  const user = await db.collection("users").findOne(
    { id: payload.sub },
    { projection: { _id: 0, password_hash: 0 } }
  );

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export async function assertProjectOwner(projectId: string, userId: string): Promise<any> {
  const db = await getDb();
  const project = await db.collection("projects").findOne({ id: projectId }, { projection: { _id: 0 } });
  if (!project) {
    const err = new Error("Project not found");
    (err as any).status = 404;
    throw err;
  }
  if (project.owner_id !== userId) {
    const err = new Error("Forbidden");
    (err as any).status = 403;
    throw err;
  }
  return project;
}
