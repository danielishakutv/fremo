import * as React from "react";

type P = React.SVGProps<SVGSVGElement>;
const base = "currentColor";

export const PlayIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill={base} {...p}>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.79-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
  </svg>
);

export const SearchIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const DownloadIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export const CloseIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const CheckIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="m20 6-11 11-5-5" />
  </svg>
);

export const FilmIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4" />
  </svg>
);

export const SparkIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill={base} {...p}>
    <path d="M12 2l1.8 5.5L19 9l-5.2 1.5L12 16l-1.8-5.5L5 9l5.2-1.5L12 2Z" />
  </svg>
);

export const AlertIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export const ExternalIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);

export const MusicIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

export const LinkIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const VideoIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m16 10 6-3v10l-6-3" />
  </svg>
);

export const ClockIcon = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
