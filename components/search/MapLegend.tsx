import styles from "./MapLegend.module.css";

const ITEMS = [
  { className: styles.swatchCity, label: "Not discovered" },
  { className: styles.swatchExpanded, label: "Expanded" },
  { className: styles.swatchUcs, label: "UCS frontier / tree" },
  { className: styles.swatchAstar, label: "A* frontier / tree" },
  { className: styles.swatchUcsHighlight, label: "UCS city highlight" },
  { className: styles.swatchAstarHighlight, label: "A* city highlight" },
  { className: styles.swatchPath, label: "Final optimal path" },
] as const;

export default function MapLegend() {
  return (
    <details className={styles.legend}>
      <summary><LegendIcon />Map key</summary>
      <div className={styles.legendContent}>
        {ITEMS.map((item) => (
          <div className={styles.legendRow} key={item.label}>
            <span className={item.className} />
            {item.label}
          </div>
        ))}
      </div>
    </details>
  );
}

function LegendIcon() {
  return (
    <svg className={styles.smallIcon} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m3 5 4-2 6 2 4-2v12l-4 2-6-2-4 2Z" />
      <path d="M7 3v12M13 5v12" />
    </svg>
  );
}
