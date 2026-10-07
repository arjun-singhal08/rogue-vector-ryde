import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BadgeCheck, AlertTriangle, WifiOff, Menu, Shield } from "lucide-react";
import type { DisputeCase, ReviewResult } from "./types";
import Sidebar, { SidebarNav } from "./components/Sidebar";
import CaseHeader from "./components/CaseHeader";
import EvidencePanel from "./components/EvidencePanel";
import DecisionPanel from "./components/DecisionPanel";
import AdvocateCards from "./components/AdvocateCards";
import ReviewSequence from "./components/ReviewSequence";
import { Sheet, SheetTrigger, SheetContent } from "./components/ui/sheet";

// ---------------------------------------------------------------------------
// Accessible announcer — speaks significant status changes once
// ---------------------------------------------------------------------------
function useAnnouncer() {
  const [text, setText] = useState("");
  const lastRef = useRef("");

  const announce = useCallback((message: string) => {
    if (message && message !== lastRef.current) {
      lastRef.current = message;
      setText(message);
      window.setTimeout(() => {
        lastRef.current = "";
        setText("");
      }, 1000);
    }
  }, []);

  return { text, announce };
}

// ---------------------------------------------------------------------------
// Review polling hook
// ---------------------------------------------------------------------------
function useCaseReviews() {
  const [reviews, setReviews] = useState<Record<number, ReviewResult>>({});
  const [stages, setStages] = useState<Record<number, "rider" | "driver" | "judge" | null>>({});

  const activeReviewIds = useRef<Record<number, string>>({});
  const pollTimers = useRef<Record<number, number>>({});
  const abortControllers = useRef<Record<number, AbortController>>({});

  const cleanupCase = useCallback((caseId: number) => {
    if (pollTimers.current[caseId]) {
      window.clearTimeout(pollTimers.current[caseId]);
      delete pollTimers.current[caseId];
    }
    abortControllers.current[caseId]?.abort();
    delete abortControllers.current[caseId];
    delete activeReviewIds.current[caseId];
  }, []);

  const pollReviewRef = useRef<
    ((caseId: number, reviewId: string) => Promise<void>) | null
  >(null);

  const pollReview = useCallback(
    async (caseId: number, reviewId: string) => {
      const controller = new AbortController();
      abortControllers.current[caseId] = controller;

      try {
        const res = await fetch(`/api/reviews/${reviewId}`, {
          signal: controller.signal,
        });

        if (activeReviewIds.current[caseId] !== reviewId) return;

        if (!res.ok) {
          if (res.status === 404) {
            setReviews((prev) => ({
              ...prev,
              [caseId]: {
                caseId,
                status: "failed",
                error:
                  "Review not found on the server. The server may have restarted.",
              },
            }));
            setStages((prev) => ({ ...prev, [caseId]: null }));
            cleanupCase(caseId);
            return;
          }
          pollTimers.current[caseId] = window.setTimeout(
            () => pollReviewRef.current?.(caseId, reviewId),
            2500
          );
          return;
        }

        const data = (await res.json()) as {
          review_id: string;
          case_id: number;
          status: "running" | "complete" | "failed";
          stage: "rider" | "driver" | "judge" | null;
          rider_case: string | null;
          driver_case: string | null;
          ruling: {
            decision: string;
            confidence: string;
            explanation: string;
            escalate: boolean;
          } | null;
          error: string | null;
        };

        if (activeReviewIds.current[caseId] !== reviewId) return;

        setStages((prev) => ({ ...prev, [caseId]: data.stage }));

        const mapped: ReviewResult = {
          caseId: data.case_id,
          status: data.status,
          riderCase: data.rider_case ?? undefined,
          driverCase: data.driver_case ?? undefined,
          decision: data.ruling?.decision ?? undefined,
          confidence: data.ruling?.confidence ?? undefined,
          explanation: data.ruling?.explanation ?? undefined,
          escalate: data.ruling?.escalate ?? undefined,
          error: data.error ?? undefined,
        };

        setReviews((prev) => ({ ...prev, [caseId]: mapped }));

        if (data.status === "running") {
          pollTimers.current[caseId] = window.setTimeout(
            () => pollReviewRef.current?.(caseId, reviewId),
            1500
          );
        } else {
          cleanupCase(caseId);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (activeReviewIds.current[caseId] !== reviewId) return;
        pollTimers.current[caseId] = window.setTimeout(
          () => pollReviewRef.current?.(caseId, reviewId),
          2500
        );
      }
    },
    [cleanupCase]
  );

  useLayoutEffect(() => {
    pollReviewRef.current = pollReview;
  });

  const startReview = useCallback(
    async (caseId: number) => {
      cleanupCase(caseId);

      setReviews((prev) => ({
        ...prev,
        [caseId]: { caseId, status: "running" },
      }));
      setStages((prev) => ({ ...prev, [caseId]: null }));

      try {
        const res = await fetch(`/api/cases/${caseId}/reviews`, {
          method: "POST",
        });

        if (res.status === 409) {
          const data = (await res.json().catch(() => ({}))) as {
            detail?: string;
          };
          setReviews((prev) => ({
            ...prev,
            [caseId]: {
              caseId,
              status: "failed",
              error:
                data.detail ||
                "A review is already running for this case.",
            },
          }));
          setStages((prev) => ({ ...prev, [caseId]: null }));
          return;
        }

        if (res.status === 503) {
          const data = (await res.json().catch(() => ({}))) as {
            detail?: string;
          };
          setReviews((prev) => ({
            ...prev,
            [caseId]: {
              caseId,
              status: "failed",
              error:
                data.detail || "Server is at capacity. Please try again later.",
            },
          }));
          setStages((prev) => ({ ...prev, [caseId]: null }));
          return;
        }

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            detail?: string;
          };
          setReviews((prev) => ({
            ...prev,
            [caseId]: {
              caseId,
              status: "failed",
              error: data.detail || "Failed to start review.",
            },
          }));
          setStages((prev) => ({ ...prev, [caseId]: null }));
          return;
        }

        const data = (await res.json()) as { review_id: string };
        activeReviewIds.current[caseId] = data.review_id;
        pollReview(caseId, data.review_id);
      } catch {
        setReviews((prev) => ({
          ...prev,
          [caseId]: {
            caseId,
            status: "failed",
            error:
              "Network error. Please check your connection and try again.",
          },
        }));
        setStages((prev) => ({ ...prev, [caseId]: null }));
      }
    },
    [cleanupCase, pollReview]
  );

  const retryReview = useCallback(
    (caseId: number) => {
      setReviews((prev) => {
        const copy = { ...prev };
        delete copy[caseId];
        return copy;
      });
      setStages((prev) => {
        const copy = { ...prev };
        delete copy[caseId];
        return copy;
      });
      startReview(caseId);
    },
    [startReview]
  );

  useEffect(() => {
    return () => {
      const timers = pollTimers.current;
      const controllers = abortControllers.current;
      Object.values(timers).forEach(window.clearTimeout);
      Object.values(controllers).forEach((c) => c.abort());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { reviews, stages, startReview, retryReview };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [cases, setCases] = useState<DisputeCase[]>([]);
  const [selectedId, setSelectedId] = useState<number>(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [groqConfigured, setGroqConfigured] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { reviews, stages, startReview, retryReview } = useCaseReviews();
  const { text: announcement, announce } = useAnnouncer();

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json().catch(() => ({ status: "error" })))
      .then((d: { status?: string; groq_configured?: boolean }) =>
        setGroqConfigured(d.groq_configured ?? false)
      )
      .catch(() => setGroqConfigured(false));

    fetch("/api/cases")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load cases from server.");
        return r.json();
      })
      .then((data: DisputeCase[]) => {
        setCases(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
          announce(`Loaded ${data.length} cases.`);
        }
      })
      .catch((err: Error) => {
        setApiError(err.message);
        announce(err.message);
      });
  }, [announce]);

  useEffect(() => {
    const result = selectedId ? reviews[selectedId] : undefined;
    if (result?.status === "complete") {
      announce(`Case ${selectedId} review complete. Decision: ${result.decision}.`);
    } else if (result?.status === "failed") {
      announce(`Case ${selectedId} review failed. ${result.error}`);
    }
  }, [reviews, selectedId, announce]);

  const selectedCase = useMemo(
    () => cases.find((c) => c.id === selectedId),
    [cases, selectedId]
  );

  const currentResult = selectedId ? reviews[selectedId] : undefined;
  const currentStage = selectedId ? (stages[selectedId] ?? null) : null;

  const isRunning = currentResult?.status === "running";
  const hasFailed = currentResult?.status === "failed";

  const handleSelectCase = useCallback((id: number) => {
    setSelectedId(id);
    setMobileOpen(false);
  }, []);

  return (
    <div className="flex h-screen bg-workspace overflow-hidden">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {/* Desktop sidebar */}
      <Sidebar
        cases={cases}
        selectedId={selectedId}
        onSelect={handleSelectCase}
      />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="bg-surface border-b border-border px-4 sm:px-5 py-3 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile menu button */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-md border border-border text-text-secondary hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal/50"
                    aria-label="Open navigation"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col bg-navy">
                  <div className="px-5 pt-6 pb-4 shrink-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <Shield className="w-5 h-5 text-teal" aria-hidden />
                      <span className="font-semibold text-sm tracking-wide text-white">RydeResolve</span>
                    </div>
                    <div className="text-[11px] text-slate-300 tracking-wide">Built by ROGUE VECTOR</div>
                  </div>
                  <SidebarNav cases={cases} selectedId={selectedId} onSelect={handleSelectCase} />
                  <div className="px-5 py-4 text-[11px] text-slate-400 border-t border-white/10 shrink-0">
                    Synthetic data
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0">
                <h1 className="text-[15px] sm:text-[16px] font-semibold text-text-primary leading-tight truncate">
                  Two perspectives. One evidence-backed resolution.
                </h1>
                <p className="text-[11px] sm:text-[12px] text-text-muted mt-0.5 truncate">
                  Review dispute evidence, run agent analysis, and see a recommended outcome.
                </p>
              </div>
            </div>
            <div className="shrink-0 hidden sm:block">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-muted bg-slate-100 border border-border rounded-full px-2.5 py-1">
                <BadgeCheck className="w-3.5 h-3.5 text-teal" />
                Synthetic data
              </span>
            </div>
          </div>
        </header>

        {apiError && (
          <div
            className="shrink-0 px-4 sm:px-5 py-2 bg-red-50 border-b border-red-200 text-[13px] text-red-700 flex items-center gap-2"
            role="alert"
          >
            <WifiOff className="w-4 h-4 shrink-0" />
            {apiError}
          </div>
        )}

        {groqConfigured === false && !apiError && (
          <div
            className="shrink-0 px-4 sm:px-5 py-2 bg-amber-light border-b border-amber text-[13px] text-amber flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Server API key is not configured. Reviews cannot be started until GROQ_API_KEY is set on the backend.
          </div>
        )}

        <div className="flex-1 p-4 sm:p-5 overflow-y-auto overflow-x-hidden">
          {selectedCase ? (
            <div
              key={selectedId}
              className="max-w-6xl mx-auto space-y-4 content-enter"
            >
              <CaseHeader
                dispute={selectedCase}
                onReview={() => startReview(selectedCase.id)}
                onRetry={() => retryReview(selectedCase.id)}
                isRunning={isRunning}
                hasFailed={hasFailed}
              />

              <ReviewSequence stage={currentStage} isRunning={isRunning} />

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
                <div className="lg:col-span-3 min-w-0">
                  <EvidencePanel dispute={selectedCase} />
                </div>
                <div className="lg:col-span-2 min-w-0">
                  <DecisionPanel result={currentResult} />
                </div>
              </div>

              <AdvocateCards result={currentResult} />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto text-[13px] text-text-muted">
              {apiError
                ? "Could not load cases. Check that the backend is running."
                : "Loading cases…"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
