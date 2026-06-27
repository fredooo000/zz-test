"use client";

import { Check } from "lucide-react";

interface ServerItem {
  id: string;
  name: string;
  shortLabel: string;
  color: string;
  disabled?: boolean;
}

interface ServerSelectorProps {
  servers: ServerItem[];
  active: string;
  onSelect: (id: string) => void;
  loading?: boolean;
}

export function ServerSelector({ servers, active, onSelect, loading }: ServerSelectorProps) {
  const activeColor = servers.find((s) => s.id === active)?.color || "#F59E0B";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Servers</span>
        {active && (
          <span className="text-xs text-slate-400">
            Active:{" "}
            <span className="font-semibold" style={{ color: activeColor }}>
              {servers.find((s) => s.id === active)?.name || active}
            </span>
          </span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {servers.map((s) => {
          const isActive = s.id === active;
          return (
            <button
              key={s.id}
              type="button"
              disabled={s.disabled || loading}
              onClick={() => onSelect(s.id)}
              className={`
                relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                transition-all duration-200
                ${s.disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:scale-105"}
                ${isActive ? "shadow-lg shadow-black/20 scale-105" : "opacity-70 hover:opacity-100"}
              `}
              style={{
                background: isActive
                  ? `linear-gradient(135deg, ${s.color}22, ${s.color}11)`
                  : "rgba(255,255,255,0.04)",
                border: isActive ? `1.5px solid ${s.color}66` : "1px solid rgba(255,255,255,0.08)",
                color: isActive ? s.color : "rgba(255,255,255,0.6)",
              }}
              title={s.disabled ? `${s.name} (unavailable for this title)` : s.name}
            >
              <span
                className="size-1.5 rounded-full shrink-0"
                style={{ background: isActive ? s.color : "rgba(255,255,255,0.2)" }}
              />
              <span>{s.shortLabel}</span>
              {isActive && <Check className="size-3 shrink-0" style={{ color: s.color }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ServerSelectorSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-14 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
