import { useEffect, useState } from "react";
import { NODE_TYPES } from "@/lib/nodeTypes";

export default function CommandPalette({ open, onClose, onPick }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;
  const filtered = NODE_TYPES.filter(
    (n) =>
      n.type.toLowerCase().includes(q.toLowerCase()) ||
      n.short.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 bg-cf-bg/80 z-50 flex items-start justify-center pt-32 p-4"
      onClick={onClose}
      data-testid="command-palette"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-cf-line bg-cf-surface"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered[0]) {
              onPick(filtered[0].type);
            }
          }}
          placeholder="Add node — type to filter (e.g. api, schema)..."
          className="w-full bg-cf-bg border-b border-cf-line px-4 py-3 text-sm focus:outline-none"
          data-testid="command-palette-input"
        />
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-4 py-3 text-xs text-cf-mute">No matches.</div>
          )}
          {filtered.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.type}
                onClick={() => onPick(n.type)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-cf-elev text-left border-b border-cf-line last:border-b-0"
                data-testid={`command-palette-option-${n.short.toLowerCase()}`}
              >
                <div className="w-1 h-7" style={{ background: n.bg }} />
                <Icon size={14} className="text-cf-dim" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold">{n.type}</div>
                  <div className="text-[10px] text-cf-mute">{n.blurb}</div>
                </div>
                <span className="text-[9px] text-cf-mute uppercase tracking-widest">
                  {n.short}
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-4 py-2 text-[10px] text-cf-mute border-t border-cf-line flex items-center justify-between">
          <span>↵ ADD · ESC CLOSE</span>
          <span>{filtered.length} TYPES</span>
        </div>
      </div>
    </div>
  );
}
