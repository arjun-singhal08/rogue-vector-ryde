import { User, Truck, Scale, CheckCircle2 } from "lucide-react";

interface ReviewSequenceProps {
  stage: "rider" | "driver" | "judge" | null;
  isRunning: boolean;
}

const stages = [
  { key: "rider" as const, label: "Rider Advocate", icon: User },
  { key: "driver" as const, label: "Driver Advocate", icon: Truck },
  { key: "judge" as const, label: "Judge", icon: Scale },
] as const;

export default function ReviewSequence({ stage, isRunning }: ReviewSequenceProps) {
  if (!isRunning && !stage) return null;

  const currentIndex = stage ? stages.findIndex((s) => s.key === stage) : -1;

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">
        Simulated review
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {stages.map((s, i) => {
          const isCompleted = currentIndex > i;
          const isActive = currentIndex === i;
          const isPending = currentIndex < i;

          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={[
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-200",
                  isCompleted ? "bg-teal-light text-teal-dark" : "",
                  isActive ? "bg-teal text-white" : "",
                  isPending ? "bg-slate-100 text-text-muted" : "",
                ].join(" ")}
                style={isActive ? { animation: "stage-pulse 1.6s ease-in-out infinite" } : undefined}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <s.icon className="w-3.5 h-3.5" />
                )}
                {s.label}
              </div>
              {i < stages.length - 1 && (
                <div className="w-6 h-px bg-border relative overflow-hidden">
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
