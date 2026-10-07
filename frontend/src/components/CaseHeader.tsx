import { Sparkles, FileText } from "lucide-react";
import type { DisputeCase } from "../types";

interface CaseHeaderProps {
  dispute: DisputeCase;
  onPreview: () => void;
  isRunning: boolean;
}

function amountInfo(ev: DisputeCase["evidence"]): { label: string; value: string } | null {
  const td = ev.trip_data;
  if (td?.cleaning_fee) return { label: "Cleaning fee", value: `$${td.cleaning_fee.toFixed(2)}` };
  if (td?.cancellation_fee) return { label: "Cancellation fee", value: `$${td.cancellation_fee.toFixed(2)}` };
  if (ev.fare_breakdown?.total_charged) return { label: "Total charged", value: `$${(ev.fare_breakdown.total_charged as number).toFixed(2)}` };
  return null;
}

export default function CaseHeader({ dispute, onPreview, isRunning }: CaseHeaderProps) {
  const info = amountInfo(dispute.evidence);

  return (
    <div className="bg-surface rounded-lg shadow-card border border-border p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal bg-teal-light px-2 py-0.5 rounded">
              <FileText className="w-3.5 h-3.5" />
              Case #{dispute.id}
            </span>
            <span className="text-[11px] text-text-muted uppercase tracking-wider">
              {dispute.title}
            </span>
          </div>
          <p className="text-[15px] text-text-primary leading-relaxed">{dispute.rider_complaint}</p>
          {info && (
            <div className="mt-2 text-[13px] text-text-secondary">
              {info.label}: <span className="font-semibold text-text-primary">{info.value}</span>
            </div>
          )}
        </div>
        <div className="shrink-0">
          <button
            onClick={onPreview}
            disabled={isRunning}
            className={[
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium btn-glow btn-sheen btn-press focus:outline-none focus:ring-2 focus:ring-teal/40",
              isRunning
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-teal text-white hover:bg-teal-dark",
            ].join(" ")}
          >
            {isRunning ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Simulated review…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Preview review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
