export async function askLlm(systemMessage: string, userMessage: string): Promise<string> {
  const useLocal = (process.env.USE_LOCAL_LLM || "false").toLowerCase() === "true";
  
  let url = "";
  let model = "";
  let apiKey = "";
  
  if (useLocal) {
    url = (process.env.LOCAL_LLM_URL || "http://localhost:11434/v1").replace(/\/$/, "");
    model = process.env.LOCAL_LLM_MODEL || "llama3";
  } else {
    url = "https://api.emergentintegrations.com/v1";
    model = "claude-sonnet-4-5-20250929";
    apiKey = process.env.EMERGENT_LLM_KEY || "";
  }
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  const payload = {
    model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    stream: false,
  };
  
  const targetUrl = `${url}/chat/completions`;
  
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000), // 120s timeout
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API returned status ${res.status}: ${errText}`);
    }
    
    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || "";
  } catch (err: any) {
    const msg = err.message || String(err);
    const low = msg.toLowerCase();
    
    if (low.includes("timeout") || low.includes("timed out") || err.name === "TimeoutError") {
      throw {
        status: 504,
        message: "Local LLM request timed out. The local model took too long to generate a response (limit: 120s). Please check if your local server is overloaded or running on slow hardware.",
      };
    }
    
    if (low.includes("refused") || low.includes("fetch failed") || low.includes("connect")) {
      throw {
        status: 503,
        message: `Local LLM server is offline or unreachable. Please make sure your LLM service (Ollama or LM Studio) is active and running at ${url}.`,
      };
    }
    
    throw {
      status: 502,
      message: `AI error: ${msg.slice(0, 300)}`,
    };
  }
}
