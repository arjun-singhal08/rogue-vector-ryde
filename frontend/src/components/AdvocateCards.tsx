import { ChevronDown, ChevronUp, User, Truck } from "lucide-react";
import { useState } from "react";
import type { ReviewResult } from "../types";

function AdvocateCard({
  title,
  icon: Icon,
  text,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  text: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  const preview = text.length > 280 ? text.slice(0, 280).trim() + "…" : text;

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[13px] text-text-secondary leading-relaxed">{open ? text : preview}</p>
        {text.length > 280 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-teal hover:text-teal-dark"
          >
            {open ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Read full reasoning
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface AdvocateCardsProps {
  result: ReviewResult | undefined;
}

export default function AdvocateCards({ result }: AdvocateCardsProps) {
  if (!result) return null;
  if (!result.riderCase && !result.driverCase) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {result.riderCase && (
        <AdvocateCard title="Rider Advocate" icon={User} text={result.riderCase} accent="#087F8C" />
      )}
      {result.driverCase && (
        <AdvocateCard title="Driver Advocate" icon={Truck} text={result.driverCase} accent="#D97706" />
      )}
    </div>
  );
}
