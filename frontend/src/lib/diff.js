// Simple line-based diff using LCS.
// Returns array of { type: 'eq' | 'add' | 'del', line: string }
export function lineDiff(before, after) {
  const a = (before || "").split("\n");
  const b = (after || "").split("\n");
  const m = a.length;
  const n = b.length;
  // LCS DP
  const dp = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0,
    j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "eq", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", line: a[i] });
      i++;
    } else {
      out.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < m) out.push({ type: "del", line: a[i++] });
  while (j < n) out.push({ type: "add", line: b[j++] });
  return out;
}

export function diffStats(diff) {
  let add = 0,
    del = 0;
  for (const d of diff) {
    if (d.type === "add") add++;
    else if (d.type === "del") del++;
  }
  return { add, del };
}
