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

function apiUrl(path: string): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) || "";
  return base.replace(/\/+$/, "") + path;
}

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
        const res = await fetch(apiUrl(`/api/reviews/${reviewId}`), {
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
          operational_state?: "processing" | "waiting_retry";
          retry_deadline?: number;
          rider_case: string | null;
          driver_case: string | null;
          ruling: {
            decision: string;
            confidence: string;
            explanation: string;
            escalate: boolean;
          } | null;
          error: string | null;
          elapsed_ms: number | null;
        };

        if (activeReviewIds.current[caseId] !== reviewId) return;

        setStages((prev) => ({ ...prev, [caseId]: data.stage }));

        const mapped: ReviewResult = {
          caseId: data.case_id,
          status: data.status,
          operationalState: data.operational_state,
          retryDeadline: data.retry_deadline,
          riderCase: data.rider_case ?? undefined,
          driverCase: data.driver_case ?? undefined,
          decision: data.ruling?.decision ?? undefined,
          confidence: data.ruling?.confidence ?? undefined,
          explanation: data.ruling?.explanation ?? undefined,
          escalate: data.ruling?.escalate ?? undefined,
          error: data.error ?? undefined,
          elapsedMs: data.elapsed_ms ?? undefined,
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
        const res = await fetch(apiUrl(`/api/cases/${caseId}/reviews`), {
          method: "POST",
        });

        if (res.status === 409) {
          const data = (await res.json().catch(() => ({}))) as {
            detail?: string;
            review_id?: string;
          };
          
          if (data.review_id) {
            // Attach to existing review
            activeReviewIds.current[caseId] = data.review_id;
            pollReview(caseId, data.review_id);
            return;
          } else {
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
              "Could not reach the backend. If the server just started, it may still be waking up—wait a moment and try again.",
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
// Skeleton UI
// ---------------------------------------------------------------------------
function AppSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-4 animate-pulse content-enter">
      {/* Starting Service Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-slate-300 border-t-teal animate-spin shrink-0" />
        <div className="text-[13px] font-medium text-slate-700 text-center sm:text-left">
          Starting review service... <span className="font-normal text-slate-500 block sm:inline mt-1 sm:mt-0">This may take about a minute on free hosting.</span>
        </div>
      </div>

      {/* CaseHeader Skeleton */}
      <div className="bg-surface rounded-xl shadow-card border border-border p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-3">
              <div className="h-5 bg-slate-100 rounded w-20"></div>
              <div className="h-5 bg-slate-100 rounded w-32"></div>
            </div>
            <div className="space-y-2 mb-2">
              <div className="h-4 bg-slate-100 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            </div>
          </div>
          <div className="shrink-0">
            <div className="h-10 w-32 bg-slate-200 rounded-md"></div>
          </div>
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Evidence Skeleton */}
        <div className="lg:col-span-3 bg-surface rounded-xl shadow-card border border-border p-5 space-y-4">
          <div className="h-5 bg-slate-200 rounded w-32 mb-2"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-4/5"></div>
          </div>
          <div className="space-y-3 mt-4">
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
          </div>
        </div>
        {/* Decision Skeleton */}
        <div className="lg:col-span-2 bg-surface rounded-xl shadow-card border border-border p-5 space-y-4">
          <div className="h-5 bg-slate-200 rounded w-24 mb-2"></div>
          <div className="h-12 bg-slate-100 rounded w-full"></div>
          <div className="space-y-3">
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const { reviews, stages, startReview, retryReview } = useCaseReviews();
  const { text: announcement, announce } = useAnnouncer();

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 12; // up to 60 seconds
    let timeoutId: number;
    let mounted = true;

    const checkHealthAndCases = async () => {
      try {
        const [healthRes, casesRes] = await Promise.all([
          fetch(apiUrl("/api/health")),
          fetch(apiUrl("/api/cases"))
        ]);

        if (healthRes.ok && casesRes.ok) {
          const healthData = await healthRes.json();
          if (mounted) setGroqConfigured(healthData.groq_configured ?? false);

          const casesData = await casesRes.json();
          if (mounted) {
            setCases((prev) => prev.length ? prev : casesData);
            if (casesData.length > 0) {
              setSelectedId((prev) => prev || casesData[0].id);
              if (attempts === 0) announce(`Loaded ${casesData.length} cases.`);
            }
            setIsInitializing(false);
            setIsReady(true);
            setApiError(null);
          }
          return;
        }
      } catch {
        // Silently ignore during initialization, let it retry
      }

      attempts++;
      if (attempts < maxAttempts) {
        timeoutId = window.setTimeout(checkHealthAndCases, 5000);
      } else {
        if (mounted) {
          setIsInitializing(false);
          setIsReady(false);
          setApiError("Could not reach the backend. If you just deployed, the server may be waking up - wait 30-60 seconds and refresh.");
          announce("Failed to connect to the backend.");
        }
      }
    };

    checkHealthAndCases();

    return () => {
      mounted = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
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
          {cases.length === 0 && isInitializing ? (
            <AppSkeleton />
          ) : selectedCase ? (
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
                isReady={isReady}
              />

              <ReviewSequence
                stage={currentStage}
                status={currentResult?.status}
                isRunning={isRunning}
              />

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
                ? "Could not reach the backend. If you just deployed, the server may be waking up—wait 30–60 seconds and refresh."
                : "Loading cases…"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
