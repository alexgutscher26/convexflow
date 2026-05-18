import crypto from "crypto";

const PAT_ENCRYPTION_KEY = process.env.PAT_ENCRYPTION_KEY || "";

interface FernetKeys {
  signingKey: Buffer;
  encryptionKey: Buffer;
}

export function getFernetKeys(keyBase64: string): FernetKeys {
  // Pad if necessary to be standard base64
  let base64 = keyBase64.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  const key = Buffer.from(base64, "base64");
  if (key.length !== 32) {
    throw new Error(`Fernet key must decode to exactly 32 bytes, got ${key.length} bytes.`);
  }

  // Fernet key splits: first 16 bytes for HMAC signing, second 16 bytes for AES-128 encryption
  return {
    signingKey: key.subarray(0, 16),
    encryptionKey: key.subarray(16, 32),
  };
}

export function encryptPat(plaintext: string): string {
  if (!PAT_ENCRYPTION_KEY) {
    throw new Error("PAT_ENCRYPTION_KEY environment variable is not configured.");
  }

  const { signingKey, encryptionKey } = getFernetKeys(PAT_ENCRYPTION_KEY);

  const version = Buffer.from([0x80]);

  // Current timestamp in seconds, represented as an 8-byte big-endian uint64
  const nowSeconds = Math.floor(Date.now() / 1000);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(nowSeconds));

  // 16-byte random IV
  const iv = crypto.randomBytes(16);

  // Encrypt using AES-128-CBC with PKCS7 padding (Node's default)
  const cipher = crypto.createCipheriv("aes-128-cbc", encryptionKey, iv);
  let ciphertext = cipher.update(plaintext, "utf8");
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  // Compute HMAC over: version + timestamp + iv + ciphertext
  const hmacInput = Buffer.concat([version, timestamp, iv, ciphertext]);
  const hmac = crypto.createHmac("sha256", signingKey).update(hmacInput).digest();

  // Combined packet: Version (1) + Timestamp (8) + IV (16) + Ciphertext (N) + HMAC (32)
  const combined = Buffer.concat([version, timestamp, iv, ciphertext, hmac]);

  // Standard Fernet outputs URL-safe base64 (base64url)
  return combined.toString("base64url");
}

export function decryptPat(token: string): string {
  if (!token) return "";
  if (!PAT_ENCRYPTION_KEY) {
    console.warn("PAT_ENCRYPTION_KEY is not set. Treating GitHub PAT as plaintext.");
    return token;
  }

  try {
    const { signingKey, encryptionKey } = getFernetKeys(PAT_ENCRYPTION_KEY);

    // Convert standard/url-safe base64 to Buffer
    let base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const combined = Buffer.from(base64, "base64");

    // Minimum payload: 1 (version) + 8 (time) + 16 (IV) + 16 (min cipher block) + 32 (HMAC) = 73 bytes
    if (combined.length < 73) {
      console.warn("Encrypted PAT is too short to be Fernet. Falling back to plaintext.");
      return token;
    }

    const version = combined[0];
    if (version !== 0x80) {
      console.warn("Invalid Fernet version byte. Falling back to plaintext.");
      return token;
    }

    const timestamp = combined.subarray(1, 9);
    const iv = combined.subarray(9, 25);
    const ciphertext = combined.subarray(25, combined.length - 32);
    const hmacReceived = combined.subarray(combined.length - 32);

    // Recompute and verify HMAC using a timing-safe comparison
    const hmacInput = Buffer.concat([combined.subarray(0, 1), timestamp, iv, ciphertext]);
    const hmacExpected = crypto.createHmac("sha256", signingKey).update(hmacInput).digest();

    if (!crypto.timingSafeEqual(hmacReceived, hmacExpected)) {
      console.warn("Fernet HMAC verification failed. Falling back to plaintext.");
      return token;
    }

    // Decrypt using AES-128-CBC
    const decipher = crypto.createDecipheriv("aes-128-cbc", encryptionKey, iv);
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString("utf8");
  } catch (err) {
    console.warn("Fernet decryption failed. Falling back to plaintext:", err);
    return token;
  }
}
