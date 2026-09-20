// components/search/HeuristicExplainLink.tsx
"use client";

import Link from "next/link";

import { useSearchStore } from "../../stores/useSearchStore";
import styles from "./HeuristicExplainLink.module.css";

export default function HeuristicExplainLink() {
  const startCity = useSearchStore((state) => state.startCity);
  const destinationCity = useSearchStore((state) => state.destinationCity);
  const hasRoute = startCity !== null && destinationCity !== null;

  if (!hasRoute) {
    return (
      <span
        className={styles.link}
        aria-disabled="true"
        title="Choose a starting point and a destination first"
      >
        How it's calculated
      </span>
    );
  }

  const href = `/heuristic-summary?start=${startCity}&goal=${destinationCity}`;

  return (
    <Link
      className={styles.link}
      href={href}
      title="See how the current-flow heuristic was calculated for this route"
    >
      How it's calculated
    </Link>
  );
}
