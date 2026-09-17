import Link from "next/link";
import styles from "./CalculationStepper.module.css";

export type CalculationStage = "circuit" | "kirchhoff-matrix" | "heuristic-steps";

type Props = { current?: CalculationStage; query?: string };

const stages: Array<{ key: CalculationStage; label: string; href: string }> = [
  { key: "circuit", label: "Circuit view", href: "/circuit-flow" },
  { key: "kirchhoff-matrix", label: "Kirchhoff matrix", href: "/kirchhoff-matrix" },
  { key: "heuristic-steps", label: "Matrix elimination", href: "/heuristic-steps" },
];

export default function CalculationStepper({ current, query = "" }: Props) {
  return (
    <nav className={styles.navigation} aria-label="Calculation pages">
      <Link className={styles.back} href="/">← Back to map</Link>
      <ol className={styles.steps}>
        {stages.map((stage, index) => (
          <li key={stage.key} className={stage.key === current ? styles.active : undefined}>
            <Link href={`${stage.href}${query}`} aria-current={stage.key === current ? "page" : undefined}>
              <span className={styles.number} aria-hidden="true">{index + 1}</span>
              <span>{stage.label}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
