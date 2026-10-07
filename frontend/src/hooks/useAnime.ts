import { useEffect, useRef } from "react";
import { animate, type AnimeParams } from "animejs";

export function useAnime(
  targets: string | HTMLElement | HTMLElement[] | NodeList | null,
  options: Omit<AnimeParams, "targets">,
  deps: React.DependencyList = []
) {
  const animRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!targets) return;
    animRef.current = animate(targets, options);

    return () => {
      animRef.current?.pause();
      animRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return animRef;
}
