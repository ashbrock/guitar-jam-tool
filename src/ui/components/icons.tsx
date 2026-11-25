// The app's icon set (DESIGN.md §6.1): 24 px grid, 1.75 px stroke, round caps, currentColor.
const I = ({ children }: { children: preact.ComponentChildren }) => (
  <svg class="i" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

export const PlayIcon = () => (
  <I>
    <path d="M7 4.5v15L19.5 12z" fill="currentColor" stroke="none" />
  </I>
);
export const PauseIcon = () => (
  <I>
    <path d="M6.5 5h4v14h-4zM13.5 5h4v14h-4z" fill="currentColor" stroke="none" />
  </I>
);
export const BackIcon = () => (
  <I>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
  </I>
);
export const RerollIcon = () => (
  <I>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
  </I>
);
export const ChevronIcon = () => (
  <I>
    <path d="m6 9 6 6 6-6" />
  </I>
);
export const MetronomeIcon = () => (
  <I>
    <path d="M9.5 3.5h5l3.5 17h-12z" />
    <path d="M12 16l5-9" />
    <path d="M8.2 13h7.6" />
  </I>
);
export const SlidersIcon = () => (
  <I>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </I>
);
