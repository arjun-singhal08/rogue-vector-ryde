import { Sparkles, FileText, RotateCcw } from "lucide-react";
import type { DisputeCase } from "../types";
import { cn } from "../lib/utils";

interface CaseHeaderProps {
  dispute: DisputeCase;
  onReview: () => void;
  onRetry?: () => void;
  isRunning: boolean;
  hasFailed: boolean;
}

function amountInfo(ev: DisputeCase["evidence"]): { label: string; value: string } | null {
  const td = ev.trip_data;
  if (td?.cleaning_fee) return { label: "Cleaning fee", value: `$${td.cleaning_fee.toFixed(2)}` };
  if (td?.cancellation_fee) return { label: "Cancellation fee", value: `$${td.cancellation_fee.toFixed(2)}` };
  if (ev.fare_breakdown?.total_charged) return { label: "Total charged", value: `$${(ev.fare_breakdown.total_charged as number).toFixed(2)}` };
  return null;
}

export default function CaseHeader({ dispute, onReview, onRetry, isRunning, hasFailed }: CaseHeaderProps) {
  const info = amountInfo(dispute.evidence);

  return (
    <div className="bg-surface rounded-xl shadow-card border border-border p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
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
            onClick={hasFailed && onRetry ? onRetry : onReview}
            disabled={isRunning}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium btn-glow btn-sheen btn-press focus:outline-none focus:ring-2 focus:ring-teal/40",
              isRunning
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : hasFailed
                  ? "bg-amber text-white hover:bg-amber-dark"
                  : "bg-teal text-white hover:bg-teal-dark"
            )}
          >
            {isRunning ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Review in progress…
              </>
            ) : hasFailed ? (
              <>
                <RotateCcw className="w-4 h-4" />
                Retry review
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Review case
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
