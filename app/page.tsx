// app/page.tsx
import RomaniaSearch from "../components/search/RomaniaSearch";
import BenchmarkPanel from "../components/benchmark/BenchmarkPanel";

export default function HomePage() {
  return <RomaniaSearch headerAction={<BenchmarkPanel />} />;
}
