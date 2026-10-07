import { useEffect, useRef } from "react";
import { User, Truck, Scale, CheckCircle2 } from "lucide-react";
import { cn } from "../lib/utils";
import { animate, stagger } from "animejs";

interface ReviewSequenceProps {
  stage: "rider" | "driver" | "judge" | null;
  isRunning: boolean;
}

const STAGES = [
  { key: "rider" as const, label: "Rider Advocate", icon: User },
  { key: "driver" as const, label: "Driver Advocate", icon: Truck },
  { key: "judge" as const, label: "Judge", icon: Scale },
] as const;

export default function ReviewSequence({ stage, isRunning }: ReviewSequenceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevStageRef = useRef<string | null>(null);

  const currentIndex = stage ? STAGES.findIndex((s) => s.key === stage) : -1;
  const hasStarted = currentIndex >= 0 || !isRunning;

  // Animate stage transitions
  useEffect(() => {
    if (!containerRef.current) return;
    if (stage && stage !== prevStageRef.current) {
      const els = containerRef.current.querySelectorAll(".stage-pill");
      const targetIndex = STAGES.findIndex((s) => s.key === stage);
      if (targetIndex >= 0 && els[targetIndex]) {
        animate(els[targetIndex], {
          scale: [0.92, 1],
          opacity: [0.6, 1],
          duration: 400,
          easing: "easeOutQuad",
        });
      }
    }
    prevStageRef.current = stage;
  }, [stage]);

  // Animate entrance when review starts
  useEffect(() => {
    if (!containerRef.current) return;
    if (isRunning && prevStageRef.current === null) {
      animate(
        containerRef.current.querySelectorAll(".stage-pill, .stage-connector"),
        {
          translateY: [8, 0],
          opacity: [0, 1],
          delay: stagger(80),
          duration: 400,
          easing: "easeOutQuad",
        }
      );
    }
  }, [isRunning]);

  if (!hasStarted && !isRunning) return null;

  return (
    <div
      ref={containerRef}
      className="bg-surface rounded-xl border border-border p-4"
      aria-label="Review progress"
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-3">
        Agent workflow
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {STAGES.map((s, i) => {
          const isCompleted = currentIndex > i;
          const isActive = currentIndex === i;
          const isPending = currentIndex < i;

          return (
            <div key={s.key} className="flex items-center gap-2 stage-pill">
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors duration-300",
                  isCompleted && "bg-teal-light text-teal-dark",
                  isActive && "bg-teal text-white shadow-md",
                  isPending && "bg-slate-100 text-text-muted"
                )}
                style={isActive ? { animation: "stage-pulse 1.6s ease-in-out infinite" } : undefined}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                ) : (
                  <s.icon className="w-3.5 h-3.5" aria-hidden />
                )}
                <span>{s.label}</span>
              </div>
              {i < STAGES.length - 1 && (
                <div className="stage-connector w-6 h-px bg-border relative overflow-hidden">
                  {isCompleted && <div className="absolute inset-0 bg-teal" />}
                  {isActive && (
                    <div
                      className="absolute inset-0 bg-teal origin-left"
                      style={{ animation: "connector-fill 500ms ease-out forwards" }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
