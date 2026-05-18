export function sanitizeAndNormalizeText(v: string, maxLen: number = 30000): string {
  if (typeof v !== "string") {
    return v;
  }

  // 1. Unicode NFKC Normalization
  let normalized = v.normalize("NFKC");

  // 2. Strip Zero-Width and control characters
  normalized = normalized.replace(/[\u200b-\u200d\ufeff\u202a-\u202e]/g, "");

  // 3. Strip malicious HTML tags, embedded scripts, and inline events
  const dangerousPatterns = [
    { regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, repl: "" },
    { regex: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, repl: "" },
    { regex: /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, repl: "" },
    { regex: /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, repl: "" },
    { regex: /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, repl: "" },
    { regex: /<link\b[^>]*>/gi, repl: "" },
    { regex: /<meta\b[^>]*>/gi, repl: "" },
    { regex: /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, repl: "" },
    { regex: /javascript:\s*[^\s"'>)]*/gi, repl: "" },
    { regex: /\bon[a-z]+\s*=\s*["'][^"']*["']/gi, repl: "" },
    { regex: /\bon[a-z]+\s*=\s*[^\s>]+/gi, repl: "" }
  ];

  for (const pattern of dangerousPatterns) {
    normalized = normalized.replace(pattern.regex, pattern.repl);
  }

  // 4. Strict Length Check
  if (normalized.length > maxLen) {
    throw new Error(`Input exceeds maximum allowed length of ${maxLen} characters`);
  }

  return normalized;
}
