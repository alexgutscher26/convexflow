import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  CaretDown,
  CaretRight,
  File as FileIcon,
  Copy,
  Check,
  CircleNotch,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "sonner";

// Lightweight line-by-line syntax highlighter helper
function highlightLine(line) {
  if (!line) return " ";
  
  // Escape HTML characters to prevent XSS and tag malformations
  let escaped = line
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Step 1: Extract and hold comments to avoid processing contents
  const commentMatch = escaped.match(/(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/);
  let commentPlaceholder = null;
  if (commentMatch) {
    commentPlaceholder = commentMatch[0];
    escaped = escaped.replace(commentPlaceholder, "___COMMENT_PLACEHOLDER___");
  }

  // Step 2: Extract and hold string literals
  const strings = [];
  escaped = escaped.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g, (match) => {
    strings.push(match);
    return `___STRING_PLACEHOLDER_${strings.length - 1}___`;
  });

  // Step 3: Highlight keywords (Teal/Cyan colors to avoid style ban)
  const keywords = /\b(const|let|var|function|return|import|export|from|class|public|private|fn|impl|mut|match|go|defer|struct|package|def|if|else|for|while|try|except|break|continue|type|interface|default|case|switch|async|await|new|this|nil|null|true|false|void|int|string|boolean|any)\b/g;
  escaped = escaped.replace(keywords, `<span class="text-cyan-400 font-bold">$1</span>`);

  // Step 4: Highlight functions
  escaped = escaped.replace(/\b(\w+)(?=\()/g, `<span class="text-amber-200 font-semibold">$1</span>`);

  // Step 5: Highlight numbers
  escaped = escaped.replace(/\b(\d+)\b/g, `<span class="text-orange-400">$1</span>`);

  // Step 6: Restore string literals
  strings.forEach((str, idx) => {
    escaped = escaped.replace(`___STRING_PLACEHOLDER_${idx}___`, `<span class="text-emerald-400 font-mono">${str}</span>`);
  });

  // Step 7: Restore comments
  if (commentPlaceholder) {
    escaped = escaped.replace("___COMMENT_PLACEHOLDER___", `<span class="text-zinc-500 font-normal italic font-mono">${commentPlaceholder}</span>`);
  }

  return escaped;
}

export default function FilePreview({ path, projectId }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!projectId || !path) {
      setError("Missing project ID or file path");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .get(`/projects/${projectId}/repository/file?path=${encodeURIComponent(path)}`)
      .then(({ data }) => {
        setContent(data.content || "");
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load file preview:", err);
        setError(err.response?.data?.detail || "Failed to load file contents");
        setLoading(false);
      });
  }, [projectId, path]);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success(`Copied path/content: ${path.split("/").pop()}`);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine if it is likely a binary file or unreadable
  const isBinary = content && /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content.slice(0, 1000));

  if (loading) {
    return (
      <div className="border border-cf-line bg-zinc-950/20 my-3 p-3 flex items-center justify-center gap-2 text-cf-mute text-[11px] font-mono select-none" style={{ borderRadius: "2px" }}>
        <CircleNotch size={12} className="animate-spin text-cf-text" />
        <span>FETCHING @{path}...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-cf-line bg-zinc-950/20 my-3 p-3 flex items-center gap-2 text-cf-dim text-[11px] font-mono" style={{ borderRadius: "2px" }}>
        <Warning size={14} className="text-amber-500 shrink-0" />
        <span className="truncate">@{path} · {error}</span>
      </div>
    );
  }

  const lines = content.split("\n");
  const maxLines = 60;
  const previewLines = lines.slice(0, maxLines);
  const hasMore = lines.length > maxLines;

  return (
    <div
      className="border border-cf-line bg-zinc-950/40 my-3 w-full flex flex-col font-mono text-[11px] text-cf-text overflow-hidden transition-all duration-200"
      style={{ borderRadius: "2px" }}
      data-testid={`file-preview-${path}`}
    >
      {/* Header Bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 bg-cf-surface/60 border-b border-cf-line cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button className="text-cf-mute hover:text-cf-text shrink-0" aria-label="Toggle preview expansion">
            {expanded ? <CaretDown size={11} weight="bold" /> : <CaretRight size={11} weight="bold" />}
          </button>
          <FileIcon size={12} className="text-cf-mute shrink-0" />
          <span className="font-bold text-cf-text truncate" title={path}>
            {path.split("/").pop()}
          </span>
          <span className="text-[9px] text-cf-mute truncate ml-1 opacity-70">
            {path} ({lines.length} lines)
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isBinary && content && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-cf-elev text-cf-mute hover:text-cf-text transition-colors"
              title="Copy entire file contents"
              aria-label="Copy file content"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
            </button>
          )}
          <span className="text-[8px] tracking-widest text-cf-mute bg-cf-line px-1.5 py-0.5 border border-cf-line font-bold">
            PREVIEW
          </span>
        </div>
      </div>

      {/* Expanded Code View */}
      {expanded && (
        <div className="flex flex-col bg-zinc-950/15 overflow-hidden">
          {isBinary ? (
            <div className="p-4 text-center text-cf-mute text-[10px] select-none border-b border-cf-line">
              [Binary or unreadable file. Preview is not available.]
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[350px] divide-y divide-transparent">
              <div className="py-2 min-w-max">
                {previewLines.map((line, i) => (
                  <div key={i} className="flex hover:bg-cf-elev/20 px-1.5 group min-h-[18px]">
                    <span className="text-cf-mute text-right select-none pr-3 border-r border-cf-line opacity-30 w-10 shrink-0 text-[10px]">
                      {i + 1}
                    </span>
                    <span
                      className="flex-1 pl-3 whitespace-pre text-[11px] font-mono leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlightLine(line) }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer warning if file is truncated */}
          {hasMore && !isBinary && (
            <div className="px-3 py-1 bg-cf-surface/20 border-t border-cf-line text-[9px] text-cf-mute text-center select-none tracking-wide">
              --- SHOWING FIRST {maxLines} LINES · FULL FILE HAS {lines.length} LINES ---
            </div>
          )}
        </div>
      )}
    </div>
  );
}
