import { memo } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle } from "@phosphor-icons/react";
import { NODE_TYPE_MAP } from "@/lib/nodeTypes";

function CustomNodeBase({ data, selected }) {
  const cfg = NODE_TYPE_MAP[data.type] || NODE_TYPE_MAP["Product Overview"];
  const Icon = cfg.icon;
  const content = (data.content || "").trim();
  const preview =
    content.replace(/[#*`>_-]/g, "").trim().slice(0, 110) || cfg.blurb;
  const refCount = (data.file_references || []).length;
  const complete = content.length >= 20;

  return (
    <div
      className="font-mono"
      style={{
        width: 260,
        background: "#0a0a0b",
        border: `1px solid ${cfg.border}`,
        boxShadow: selected
          ? `4px 4px 0 ${cfg.bg}`
          : "0 0 0 transparent",
        transition: "box-shadow 80ms ease-out",
      }}
      data-testid={`canvas-node-${cfg.short.toLowerCase()}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: cfg.bg, borderColor: "#0a0a0b" }}
      />
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: cfg.bg, color: cfg.text }}
      >
        <Icon size={12} weight="bold" />
        <span className="text-[10px] uppercase tracking-widest font-bold">
          {cfg.short}
        </span>
        {complete && (
          <CheckCircle
            size={11}
            weight="fill"
            className="ml-auto"
            style={{ color: cfg.text, opacity: 0.85 }}
            data-testid="node-complete-badge"
          />
        )}
        {!complete && refCount > 0 && (
          <span
            className="ml-auto text-[9px] font-bold px-1.5 py-0.5 border"
            style={{
              borderColor: cfg.text,
              color: cfg.text,
              opacity: 0.85,
            }}
          >
            {refCount}F
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="text-[13px] font-bold text-cf-text leading-snug break-words">
          {data.title || "(untitled)"}
        </div>
        <div className="text-[11px] text-cf-dim mt-1.5 leading-snug break-words line-clamp-3">
          {preview}
        </div>
        {complete && refCount > 0 && (
          <div className="text-[9px] text-cf-mute mt-2 uppercase tracking-widest">
            {refCount} FILE{refCount > 1 ? "S" : ""} LINKED
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: cfg.bg, borderColor: "#0a0a0b" }}
      />
    </div>
  );
}

export const CustomNode = memo(CustomNodeBase);
