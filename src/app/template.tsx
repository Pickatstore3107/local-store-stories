import { ViewTransition, type ReactNode } from "react";

/**
 * Every page, wrapped so it moves as it opens: sideways when a button on
 * the bottom bar is tapped (left or right, the way the bar's button went),
 * and up into place when a post is opened from Home. Other changes, like
 * the browser's back button, just swap the page.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "open-post": "open-post", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", "open-post": "leave-page", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
