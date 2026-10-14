import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Scale,
  ShieldAlert,
  FileText,
  ChevronDown,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import type { ReviewResult } from "../types";
import { cn } from "../lib/utils";
import { animate } from "animejs";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./ui/collapsible";

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

function decisionTone(
  decision: string | undefined
): "positive" | "negative" | "neutral" | "warning" {
  if (!decision) return "neutral";
  if (decision === "UPHELD") return "positive";
  if (decision === "REJECTED") return "negative";
  if (decision === "PARTIAL" || decision === "PARTIAL REFUND") return "warning";
  return "neutral";
}

/**
 * Strip any [ESCALATION NOTICE] suffix that the backend appends to the
 * explanation so we can present it cleanly in the Next Steps section.
 */
function cleanExplanation(text: string | undefined): string {
  if (!text) return "";
  const idx = text.indexOf("[ESCALATION NOTICE]");
  if (idx >= 0) return text.slice(0, idx).trim();
  return text.trim();
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
          <h3 className="text-[15px] font-semibold text-text-primary">
            Decision Dossier
          </h3>
        </div>
        <p className="text-[14px] text-text-secondary leading-relaxed">
          No review has been run for this case. Select{" "}
          <strong>Review case</strong> to start an agent workflow.
        </p>
        <div className="mt-3 text-[12px] text-text-muted">
          Advocates present their perspectives; the judge weighs both against
          the evidence.
        </div>
      </div>
    );
  }

  if (result.status === "running") {
    const elapsedSec = result.elapsedMs
      ? Math.round(result.elapsedMs / 1000)
      : 0;
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
          <div>
            <div className="text-[14px] font-medium text-text-primary">
              Review in progress
            </div>
            <div className="text-[12px] text-text-muted mt-0.5">
              Rider Advocate &rarr; Driver Advocate &rarr; Judge
              {elapsedSec > 0 && (
                <span className="ml-1.5 tabular-nums">
                  ({elapsedSec}s elapsed)
                </span>
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
          <h3 className="text-[15px] font-semibold text-red-700">
            Review failed
          </h3>
        </div>
        <p className="text-[14px] text-red-700">
          {result.error || "An unexpected error occurred."}
        </p>
      </div>
    );
  }

  const tone = decisionTone(result.decision);
  const isSimulated = result.decision?.startsWith("SIMULATED");
  const isExplicitEscalation =
    result.decision === "ESCALATE" ||
    result.decision === "ESCALATE FOR HUMAN REVIEW";
  const isSafeguardEscalation = result.explanation?.startsWith("Safeguard activated:");

  const toneStyles = {
    positive: "bg-teal-light text-teal-dark border-teal/20",
    negative: "bg-red-50 text-red-700 border-red-200",
    warning: "bg-amber-light text-amber-dark border-amber/20",
    neutral: "bg-slate-50 text-text-primary border-border",
  };

  const reasoning = cleanExplanation(result.explanation);
  const reasoningParagraphs = reasoning
    ? reasoning.split(/\n{2,}/)
    : [];

  return (
    <div className={cn("space-y-3", reveal && "decision-reveal")} ref={contentRef}>
      {result.escalate && (
        <div className="rounded-xl border border-amber bg-amber-light p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber" />
            <span className="text-[14px] font-semibold text-amber">
              Human review required
            </span>
          </div>
          <p className="text-[12px] text-text-secondary mt-1">
            {isSafeguardEscalation
              ? "A deterministic safeguard was triggered due to missing evidence or policy."
              : isExplicitEscalation
              ? "The judge explicitly recommended escalation for human review."
              : "The model-reported confidence is below the automated-resolution threshold."}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-5 shadow-card">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-teal" />
          <h3 className="text-[15px] font-semibold text-text-primary">
            Decision Dossier
          </h3>
        </div>

        {/* Recommendation */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Recommendation
          </div>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-4 py-3 shadow-sm",
              toneStyles[tone]
            )}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[18px] font-bold tracking-tight">
              {decisionLabel(result.decision)}
            </span>
          </div>
          <div className="mt-2 text-[12px] text-text-muted">
            Model-reported confidence:{" "}
            <span className="font-semibold text-text-primary">
              {result.confidence}
            </span>
            {isSimulated && (
              <span className="text-[11px] text-text-muted ml-1">(simulated)</span>
            )}
          </div>
        </div>

        {/* Reasoning */}
        {reasoningParagraphs.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Reasoning
            </div>
            <div className="text-[14px] text-text-secondary leading-relaxed">
              {reasoningParagraphs.map((para, i) => (
                <p key={i} className={i > 0 ? "mt-3" : ""}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
            Next Steps
          </div>
          {result.escalate ? (
            <div className="rounded-lg border border-amber bg-amber-light p-3">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber" />
                <span className="text-[13px] font-medium text-amber-dark">
                  Forward to human reviewer
                </span>
              </div>
              <p className="text-[12px] text-text-secondary mt-1">
                {isSafeguardEscalation
                  ? "A deterministic safeguard has flagged this case for human review because critical evidence or policy is missing."
                  : isExplicitEscalation
                  ? "The judge explicitly recommended escalation for human review rather than finalizing automatically."
                  : "The model-reported confidence is below the automated-resolution threshold. A human reviewer should verify this recommendation before acting."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-teal/20 bg-teal-light p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-dark" />
                <span className="text-[13px] font-medium text-teal-dark">
                  Recommendation only
                </span>
              </div>
              <p className="text-[12px] text-text-secondary mt-1">
                This AI-generated recommendation has sufficient confidence, but does not automatically execute decisions. Review the reasoning before taking manual action.
              </p>
            </div>
          )}
        </div>

        {/* Data availability note */}
        <div className="rounded-lg border border-dashed border-border bg-slate-50 p-3 mb-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1">
            Data availability
          </div>
          <p className="text-[12px] text-text-muted leading-relaxed">
            The current judge schema returns decision, confidence, and
            explanation. Structured fields for{" "}
            <strong>key evidence citations</strong> and{" "}
            <strong>unresolved evidence</strong> are not yet provided by the
            backend. The reasoning above contains the judge&apos;s full analysis.
          </p>
        </div>

        {/* Technical Details */}
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="flex items-center gap-1.5 text-[13px] font-medium text-teal hover:text-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50 rounded-sm">
            <ChevronDown className="w-4 h-4 transition-transform data-[state=open]:rotate-180" />
            Technical details
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-4 pt-3">
              {result.riderCase && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted mb-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Rider Advocate argument
                  </div>
                  <div className="text-[12px] text-text-secondary bg-slate-50 border border-border rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                    {result.riderCase}
                  </div>
                </div>
              )}
              {result.driverCase && (
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted mb-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Driver Advocate argument
                  </div>
                  <div className="text-[12px] text-text-secondary bg-slate-50 border border-border rounded-lg p-3 leading-relaxed whitespace-pre-wrap">
                    {result.driverCase}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
