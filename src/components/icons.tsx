// Simple line icons, drawn in the text colour around them.
import type { ReactNode } from "react";

type IconProps = { className?: string };

function Icon({ className = "h-6 w-6", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="2.4" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6v12M6 12h12" strokeWidth="2.2" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5Zm4 3a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 6 8.5 12l6 6" />
    </Icon>
  );
}

/** The "find me" crosshair. */
export function LocateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </Icon>
  );
}

export function StoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 9.5 6 4.5h12l1.5 5" />
      <path d="M4.5 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <path d="M5.5 12v7.5h13V12M10 19.5v-4.5h4v4.5" />
    </Icon>
  );
}

export function PlaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-6.2-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.8" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function DirectionsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 21 12l-9 9-9-9 9-9Z" />
      <path d="M9.5 13.5V11a1 1 0 0 1 1-1h4m-1.5-2 2 2-2 2" />
    </Icon>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14m-6-6 6 6-6 6" strokeWidth="2.2" />
    </Icon>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L12 4Z" />
    </Icon>
  );
}

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path
        d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z"
        fill={filled ? "currentColor" : "none"}
      />
    </Icon>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4.5 19.5l1.4-4.2A7.5 7.5 0 1 1 20 11.5Z" />
    </Icon>
  );
}

/** A paper plane, for sending a memory to someone. */
export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" />
    </Icon>
  );
}

export function FlagIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 21V4.5m0 0h11l-2.5 4.25 2.5 4.25h-11" />
    </Icon>
  );
}

export function BookmarkIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Icon {...props}>
      <path d="M6.5 4.5h11v15.5L12 16.2 6.5 20V4.5Z" fill={filled ? "currentColor" : "none"} />
    </Icon>
  );
}

/** A flame, for what's trending. */
export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 21c-3.6 0-6.5-2.6-6.5-6.2 0-3.3 2.4-5.3 3.6-7.8.4 1.7 1.3 2.8 2.4 3.4C11.9 7.6 13 5 15.2 3c-.2 2.6.9 4.4 2 6 .9 1.4 1.3 2.7 1.3 4.2 0 4.6-2.9 7.8-6.5 7.8Z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M12 20.5c-1.8 0-3-1.2-3-2.9 0-1.6 1.2-2.6 1.9-3.8.3.9.8 1.4 1.4 1.7.2-1.3.8-2.4 1.8-3.3-.1 1.4.4 2.3.9 3.1.4.6.6 1.3.6 2 0 2-1.6 3.2-3.6 3.2Z"
        fill="#ffc000"
        stroke="none"
      />
    </Icon>
  );
}

/** Four squares, for "All". */
export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
      <rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 10 5 5 5-5" strokeWidth="2.2" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m10 7 5 5-5 5" strokeWidth="2.2" />
    </Icon>
  );
}

/** Two people, for followers. */
export function PeopleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="3.2" fill="currentColor" stroke="none" />
      <path d="M3 19c.8-3.3 3.2-5 6-5s5.2 1.7 6 5H3Z" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="9" r="2.6" fill="currentColor" stroke="none" opacity="0.7" />
      <path d="M15.8 14.1c2.6-.3 4.6 1.3 5.2 4.9h-4.4c-.1-1.9-.4-3.4-.8-4.9Z" fill="currentColor" stroke="none" opacity="0.7" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="2.4" />
    </Icon>
  );
}
