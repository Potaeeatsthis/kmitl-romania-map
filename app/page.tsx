// app/page.tsx
import RomaniaSearch from "../components/search/RomaniaSearch";
import BenchmarkPanel from "../components/benchmark/BenchmarkPanel";
import HeuristicExplainLink from "../components/search/HeuristicExplainLink";

export default function HomePage() {
  return (
    <RomaniaSearch
      headerAction={
        <>
          <HeuristicExplainLink />
          <BenchmarkPanel />
        </>
      }
    />
  );
}
