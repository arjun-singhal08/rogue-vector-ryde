import { Shield } from "lucide-react";
import type { DisputeCase } from "../types";
import { cn } from "../lib/utils";

interface SidebarProps {
  cases: DisputeCase[];
  selectedId: number;
  onSelect: (id: number) => void;
}

export function SidebarNav({
  cases,
  selectedId,
  onSelect,
}: {
  cases: DisputeCase[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <nav className="flex-1 px-3 pb-4 overflow-y-auto min-h-0">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 px-2 mb-2 mt-2">
        Cases
      </div>
      <ul className="space-y-1" role="list">
        {cases.map((c) => {
          const active = c.id === selectedId;
          return (
            <li key={c.id}>
              <button
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-md text-[13px] leading-snug transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal/50",
                  active
                    ? "bg-navy-light text-white ring-1 ring-teal/40"
                    : "text-slate-300 hover:bg-navy-light hover:text-white"
                )}
                aria-current={active ? "page" : undefined}
              >
                <div className="font-medium">Case #{c.id}</div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">{c.title}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Sidebar({ cases, selectedId, onSelect }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 bg-navy text-white flex-col h-screen">
      <div className="px-5 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-2.5 mb-1">
          <Shield className="w-5 h-5 text-teal" aria-hidden />
          <span className="font-semibold text-sm tracking-wide">RydeResolve</span>
        </div>
        <div className="text-[11px] text-slate-300 tracking-wide">Built by ROGUE VECTOR</div>
      </div>

      <SidebarNav cases={cases} selectedId={selectedId} onSelect={onSelect} />

      <div className="px-5 py-4 text-[11px] text-slate-400 border-t border-white/10 shrink-0">
        Synthetic data
      </div>
    </aside>
  );
}
