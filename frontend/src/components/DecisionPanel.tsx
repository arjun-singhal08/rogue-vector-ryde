import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import type { ReviewResult } from "../types";

interface DecisionPanelProps {
  result: ReviewResult | undefined;
}

export default function DecisionPanel({ result }: DecisionPanelProps) {
  const [reveal, setReveal] = useState(false);
  const prevRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const prev = prevRef.current;
    const curr = result?.status;
    if (prev === "running" && (curr === "complete" || curr === "failed")) {
      setReveal(true);
      const t = setTimeout(() => setReveal(false), 300);
      return () => clearTimeout(t);
    }
    prevRef.current = curr;
  }, [result?.status]);

  if (!result) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-text-muted" />
          <h3 className="text-[15px] font-semibold text-text-primary">Decision</h3>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          No review has been run for this case. Select <strong>Preview review</strong> to see a simulated agent workflow.
        </p>
        <div className="mt-3 text-[12px] text-text-muted">
          Advocates present their perspectives; the judge weighs both against the evidence.
        </div>
      </div>
    );
  }

  if (result.status === "running") {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
          <div>
            <div className="text-[14px] font-medium text-text-primary">Simulated review in progress</div>
            <div className="text-[12px] text-text-muted mt-0.5">Rider Advocate → Driver Advocate → Judge</div>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === "failed" || result.error) {
    return (
      <div className={["rounded-lg border border-red-200 bg-red-50 p-4", reveal ? "decision-reveal" : ""].join(" ")}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="text-[15px] font-semibold text-red-700">Review failed</h3>
        </div>
        <p className="text-[13px] text-red-700">{result.error || "An unexpected error occurred."}</p>
      </div>
    );
  }

  return (
    <div className={["space-y-4", reveal ? "decision-reveal" : ""].join(" ")}>
      {result.escalate && (
        <div className="rounded-lg border border-amber bg-amber-light p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber" />
            <span className="text-[14px] font-semibold text-amber">Human review required</span>
          </div>
          <p className="text-[12px] text-text-secondary mt-1">
            The model-reported confidence is below the automated-resolution threshold.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="w-5 h-5 text-teal" />
          <h3 className="text-[15px] font-semibold text-text-primary">Judge recommendation</h3>
        </div>
        <div className="text-[20px] font-bold text-text-primary mb-3">{result.decision}</div>
        <p className="text-[13px] text-text-secondary leading-relaxed mb-3">{result.explanation}</p>
        <div className="inline-flex items-center gap-2 text-[12px] text-text-muted bg-slate-50 border border-border rounded-md px-2.5 py-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal" />
          Illustrative confidence: <span className="font-medium text-text-primary">{result.confidence}</span>
        </div>
      </div>
    </div>
  );
}
