import styles from "./page.module.css";

export default function Loading() {
  return <p className={styles.empty} role="status">Preparing calculation…</p>;
}
