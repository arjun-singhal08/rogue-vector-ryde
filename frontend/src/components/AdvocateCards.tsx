import { ChevronDown, ChevronUp, User, Truck } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { ReviewResult } from "../types";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { animate, stagger } from "animejs";

function AdvocateCard({
  title,
  icon: Icon,
  text,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  text: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);

  const preview = text.length > 280 ? text.slice(0, 280).trim() + "…" : text;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color: accent }} />
        <span className="text-[13px] font-semibold text-text-primary">{title}</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-[13px] text-text-secondary leading-relaxed">{open ? text : preview}</p>
        {text.length > 280 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="mt-2 text-teal hover:text-teal-dark">
              <span className="flex items-center gap-1">
                {open ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Read full reasoning
                  </>
                )}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2">
                <p className="text-[13px] text-text-secondary leading-relaxed">{text}</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

interface AdvocateCardsProps {
  result: ReviewResult | undefined;
}

export default function AdvocateCards({ result }: AdvocateCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    if (containerRef.current && result && (result.riderCase || result.driverCase)) {
      hasAnimated.current = true;
      animate(containerRef.current.children, {
        translateY: [16, 0],
        opacity: [0, 1],
        delay: stagger(120),
        duration: 400,
        easing: "easeOutQuad",
      });
    }
  }, [result]);

  if (!result) return null;
  if (!result.riderCase && !result.driverCase) return null;

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {result.riderCase && (
        <AdvocateCard title="Rider Advocate" icon={User} text={result.riderCase} accent="#087F8C" />
      )}
      {result.driverCase && (
        <AdvocateCard title="Driver Advocate" icon={Truck} text={result.driverCase} accent="#D97706" />
      )}
    </div>
  );
}
