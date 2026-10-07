declare module "animejs" {
  type Targets = string | Element | HTMLElement | HTMLElement[] | NodeList | HTMLCollection | null;

  interface AnimeParams {
    duration?: number;
    delay?: number | ((el: HTMLElement, i: number, l: number) => number);
    easing?: string;
    [key: string]: unknown;
  }

  interface Animation {
    pause(): void;
    play(): void;
    restart(): void;
    reverse(): void;
    readonly completed: boolean;
  }

  export function animate(targets: Targets, params: AnimeParams): Animation;
  export function stagger(value: number): (el: HTMLElement, i: number, l: number) => number;
  export function createTimeline(params?: Record<string, unknown>): unknown;
}
