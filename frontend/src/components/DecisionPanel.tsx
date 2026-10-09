import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Scale, ShieldAlert } from "lucide-react";
import type { ReviewResult } from "../types";
import { cn } from "../lib/utils";
import { animate } from "animejs";

interface DecisionPanelProps {
  result: ReviewResult | undefined;
}

function decisionLabel(decision: string | undefined): string {
  if (!decision) return "No decision";
  const map: Record<string, string> = {
    UPHELD: "Rider complaint upheld",
    REJECTED: "Rider complaint rejected",
    PARTIAL: "Partial resolution",
    "PARTIAL REFUND": "Partial refund recommended",
    ESCALATE: "Escalate for human review",
    "ESCALATE FOR HUMAN REVIEW": "Escalate for human review",
  };
  return map[decision] ?? decision;
}

function decisionTone(decision: string | undefined): "positive" | "negative" | "neutral" | "warning" {
  if (!decision) return "neutral";
  if (decision === "UPHELD") return "positive";
  if (decision === "REJECTED") return "negative";
  if (decision === "PARTIAL" || decision === "PARTIAL REFUND") return "warning";
  return "neutral";
}

export default function DecisionPanel({ result }: DecisionPanelProps) {
  const [reveal, setReveal] = useState(false);
  const prevRef = useRef<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = prevRef.current;
    const curr = result?.status;
    if (prev === "running" && (curr === "complete" || curr === "failed")) {
      setReveal(true);
      const t = setTimeout(() => setReveal(false), 300);

      // Coordinated anime.js reveal
      if (contentRef.current) {
        animate(contentRef.current, {
          translateY: [12, 0],
          opacity: [0, 1],
          duration: 400,
          easing: "easeOutQuad",
        });
      }

      return () => clearTimeout(t);
    }
    prevRef.current = curr;
  }, [result?.status]);

  if (!result) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-text-muted" />
          <h3 className="text-[15px] font-semibold text-text-primary">Decision</h3>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          No review has been run for this case. Select <strong>Review case</strong> to start an agent workflow.
        </p>
        <div className="mt-3 text-[12px] text-text-muted">
          Advocates present their perspectives; the judge weighs both against the evidence.
        </div>
      </div>
    );
  }

  if (result.status === "running") {
    const elapsedSec = result.elapsedMs ? Math.round(result.elapsedMs / 1000) : 0;
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
          <div>
            <div className="text-[14px] font-medium text-text-primary">Review in progress</div>
            <div className="text-[12px] text-text-muted mt-0.5">
              Rider Advocate &rarr; Driver Advocate &rarr; Judge
              {elapsedSec > 0 && (
                <span className="ml-1.5 tabular-nums">({elapsedSec}s elapsed)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === "failed" || result.error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-red-200 bg-red-50 p-5",
          reveal && "decision-reveal"
        )}
        ref={contentRef}
      >
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-[15px] font-semibold text-red-700">Review failed</h3>
        </div>
        <p className="text-[13px] text-red-700">{result.error || "An unexpected error occurred."}</p>
      </div>
    );
  }

  const tone = decisionTone(result.decision);
  const isSimulated = result.decision?.startsWith("SIMULATED");
  const isExplicitEscalation =
    result.decision === "ESCALATE" || result.decision === "ESCALATE FOR HUMAN REVIEW";

  const toneStyles = {
    positive: "bg-teal-light text-teal-dark border-teal/20",
    negative: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-amber-light text-amber-dark border-amber/20",
    neutral: "bg-slate-50 text-text-primary border-border",
  };

  return (
    <div className={cn("space-y-3", reveal && "decision-reveal")} ref={contentRef}>
      {result.escalate && (
        <div className="rounded-xl border border-amber bg-amber-light p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber" />
            <span className="text-[14px] font-semibold text-amber">Human review required</span>
          </div>
          <p className="text-[12px] text-text-secondary mt-1">
            {isExplicitEscalation
              ? "The judge explicitly recommended escalation for human review."
              : "The model-reported confidence is below the automated-resolution threshold."}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="w-5 h-5 text-teal" />
          <h3 className="text-[15px] font-semibold text-text-primary">AI recommendation</h3>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 mb-4",
            toneStyles[tone]
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[18px] font-bold">{decisionLabel(result.decision)}</span>
        </div>

        {result.explanation && (
          <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
            {result.explanation}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-[12px] text-text-muted bg-slate-50 border border-border rounded-md px-2.5 py-1.5">
            <span className="font-medium">Model-reported confidence:</span>
            <span className="font-semibold text-text-primary">{result.confidence}</span>
            {isSimulated && (
              <span className="text-[11px] text-text-muted ml-1">(simulated)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
