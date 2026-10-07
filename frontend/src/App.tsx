import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck } from "lucide-react";
import { CASES, MOCK_RESULTS } from "./fixtures";
import type { ReviewResult } from "./types";
import Sidebar from "./components/Sidebar";
import CaseHeader from "./components/CaseHeader";
import EvidencePanel from "./components/EvidencePanel";
import DecisionPanel from "./components/DecisionPanel";
import AdvocateCards from "./components/AdvocateCards";
import ReviewSequence from "./components/ReviewSequence";

function useCaseResults() {
  const [results, setResults] = useState<Record<number, ReviewResult>>({});
  const [stages, setStages] = useState<Record<number, "rider" | "driver" | "judge" | null>>({});
  const timersRef = useRef<Record<number, number[]>>({});

  const clearCaseTimers = useCallback((caseId: number) => {
    timersRef.current[caseId]?.forEach(clearTimeout);
    timersRef.current[caseId] = [];
  }, []);

  const startPreview = useCallback((caseId: number) => {
    clearCaseTimers(caseId);

    setResults((prev) => ({ ...prev, [caseId]: { caseId, status: "running" } }));
    setStages((prev) => ({ ...prev, [caseId]: "rider" }));

    const delay = 1200 + Math.floor(Math.random() * 800);
    const ids: number[] = [];

    ids.push(window.setTimeout(() => setStages((prev) => ({ ...prev, [caseId]: "driver" })), Math.round(delay * 0.35)));
    ids.push(window.setTimeout(() => setStages((prev) => ({ ...prev, [caseId]: "judge" })), Math.round(delay * 0.70)));
    ids.push(window.setTimeout(() => {
      const mock = MOCK_RESULTS[caseId];
      if (mock) {
        setResults((prev) => ({ ...prev, [caseId]: { ...mock, status: "complete" } }));
      } else {
        setResults((prev) => ({
          ...prev,
          [caseId]: {
            caseId,
            status: "failed",
            error: "No preview fixture available for this case.",
          },
        }));
      }
      setStages((prev) => ({ ...prev, [caseId]: null }));
    }, delay));

    timersRef.current[caseId] = ids;
  }, [clearCaseTimers]);

  useEffect(() => {
    const timers = timersRef;
    return () => {
      Object.values(timers.current).flat().forEach(clearTimeout);
    };
  }, []);

  return { results, stages, startPreview };
}

export default function App() {
  const [selectedId, setSelectedId] = useState<number>(CASES[0].id);
  const { results, stages, startPreview } = useCaseResults();

  const selectedCase = useMemo(
    () => CASES.find((c) => c.id === selectedId) ?? CASES[0],
    [selectedId]
  );

  const currentResult = results[selectedId];
  const currentStage = stages[selectedId] ?? null;

  return (
    <div className="flex h-screen bg-workspace overflow-hidden">
      <Sidebar cases={CASES} selectedId={selectedId} onSelect={setSelectedId} />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="bg-surface border-b border-border px-5 py-3 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[16px] font-semibold text-text-primary leading-tight">
                Two perspectives. One evidence-backed resolution.
              </h1>
              <p className="text-[12px] text-text-muted mt-0.5">
                Review dispute evidence, run simulated agent analysis, and see a recommended outcome.
              </p>
            </div>
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted bg-slate-100 border border-border rounded-full px-2.5 py-1">
                <BadgeCheck className="w-3.5 h-3.5 text-teal" />
                Synthetic data · Preview mode
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-5 overflow-y-auto">
          <div key={selectedId} className="max-w-6xl mx-auto space-y-4 content-enter">
            <CaseHeader
              dispute={selectedCase}
              onPreview={() => startPreview(selectedCase.id)}
              isRunning={currentResult?.status === "running"}
            />

            <ReviewSequence
              stage={currentStage}
              isRunning={currentResult?.status === "running"}
            />

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-3">
                <EvidencePanel dispute={selectedCase} />
              </div>
              <div className="lg:col-span-2">
                <DecisionPanel result={currentResult} />
              </div>
            </div>

            <AdvocateCards result={currentResult} />
          </div>
        </div>
      </main>
    </div>
  );
}
