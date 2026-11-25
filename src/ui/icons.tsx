// The app's own icon set (DESIGN.md §6): 24 px grid, 1.75 px stroke, round caps and joins, currentColor.
import type { JSX } from 'preact';

type IconProps = { title?: string; class?: string };

function Svg({ children, title, class: cls }: IconProps & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      class={`icon ${cls ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : <></>}
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </Svg>
);

export const PauseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3" />
  </Svg>
);

export const RerollIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 10a7.5 7.5 0 0 1 13.2-3.6L19.5 8.5" />
    <path d="M19.5 4v4.5H15" />
    <path d="M19.5 14a7.5 7.5 0 0 1-13.2 3.6L4.5 15.5" />
    <path d="M4.5 20v-4.5H9" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14.5 4.5 10 9 5.5" />
    <path d="M4.5 10h9a6 6 0 0 1 0 12H11" />
  </Svg>
);

export const LockClosedIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const LockOpenIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" />
  </Svg>
);

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const MetronomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 3.5h5l4 17h-13z" />
    <path d="M12 15.5 17 7" />
  </Svg>
);
