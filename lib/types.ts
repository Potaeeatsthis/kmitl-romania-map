export interface FrontierNode {
  city: number;
  cost: number;
  priority: number;
}

export interface DiscoveredNode {
  city: number;
  cost: number;
  parent: number | null;
}

export interface SearchStep {
  expanded_city: number;
  expanded_cost: number;
  frontier: FrontierNode[];
  discovered: DiscoveredNode[];
}

export interface SearchResult {
  path: number[];
  explored_order: number[];
  trace: SearchStep[];
  cost: number;
  expanded: number;
  generated: number;
  peak_frontier: number;
  peak_records: number;
  peak_payload_bytes: number;
}

export interface SearchResponse {
  ucs: SearchResult;
  astar: SearchResult;
}
