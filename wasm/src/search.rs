use std::cmp::Ordering;
use std::collections::BinaryHeap;

use crate::graph::{validate_graph, Graph, GraphError, CITY_COUNT};
use crate::metrics::{update_peaks, DiscoveredNode, FrontierNode, SearchResult, SearchStep};

/// I5/I4: this module never panics. A route failure is a value, not a crash,
/// because a panic inside the wasm module takes the whole page down with it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchError {
    Graph(GraphError),
    InvalidStart(usize),
    InvalidGoal(usize),
    WrongHeuristicLength {
        expected: usize,
        actual: usize,
    },
    InvalidHeuristic(usize),
    GoalHeuristicNotZero(usize),
    InconsistentHeuristic {
        city: usize,
        neighbor: usize,
    },
    /// No representable (u32) route exists, and at least one candidate edge
    /// overflowed while searching. A representable route, if one exists, wins
    /// before this is returned.
    CostOverflow {
        city: usize,
        neighbor: usize,
    },
    NoRouteExists,
}

/// The engine settles a city on its first pop and never reopens it, which is
/// sound only while the heuristic is consistent (`h(u) <= w(u,v) + h(v)`) and
/// anchored at the goal (`h(goal) = 0`). An inconsistent heuristic can lock in
/// a suboptimal g before a cheaper route arrives.
///
/// `h(goal)` must be exactly zero: both shipped heuristics write a literal 0.0
/// there, and any bounded check would let a small nonzero value hide behind the
/// tolerance.
///
/// Consistency slack is scale-aware because the solver's round-off grows with
/// the magnitude of the weights (inverting a grounded Laplacian for a 49*2^20
/// road can overshoot by ~7.5e-9, which a flat 1e-9 rejects). Slack is
/// `n * eps * scale`, where `n` is the longest simple path and `scale` is the
/// largest weight or heuristic entry, capped at the largest legitimate
/// simple-path cost `u32::MAX * n`. The cap stops an out-of-range entry (say a
/// huge value on an isolated node) from widening the tolerance and masking a
/// one-unit inconsistency. At the cap the slack is ~3.5e-4, far below the
/// smallest integer cost gap of 1.
const CONSISTENCY_SCALE_EDGES: f64 = (CITY_COUNT - 1) as f64;
const MAX_LEGITIMATE_PATH_COST: f64 = u32::MAX as f64 * CONSISTENCY_SCALE_EDGES;

fn validate_heuristic(graph: &Graph, goal: usize, heuristic: &[f64]) -> Result<(), SearchError> {
    let heuristic_scale = heuristic
        .iter()
        .fold(0.0_f64, |max, &value| max.max(value.abs()));
    let weight_scale = graph
        .iter()
        .flat_map(|roads| roads.iter().map(|&(_, weight)| f64::from(weight)))
        .fold(0.0_f64, f64::max);
    let scale = heuristic_scale
        .max(weight_scale)
        .clamp(1.0, MAX_LEGITIMATE_PATH_COST);
    let tolerance = CONSISTENCY_SCALE_EDGES * f64::EPSILON * scale;

    if heuristic[goal] != 0.0 {
        return Err(SearchError::GoalHeuristicNotZero(goal));
    }
    for (city, roads) in graph.iter().enumerate() {
        for &(neighbor, weight) in roads {
            if heuristic[city] > f64::from(weight) + heuristic[neighbor] + tolerance {
                return Err(SearchError::InconsistentHeuristic { city, neighbor });
            }
        }
    }
    Ok(())
}

#[derive(Copy, Clone)]
struct QueueEntry {
    f: f64,
    g: u32,
    city: usize,
}

impl PartialEq for QueueEntry {
    fn eq(&self, other: &Self) -> bool {
        self.f.total_cmp(&other.f) == Ordering::Equal
            && self.g == other.g
            && self.city == other.city
    }
}

impl Eq for QueueEntry {}

impl Ord for QueueEntry {
    fn cmp(&self, other: &Self) -> Ordering {
        // Reverse comparisons because BinaryHeap is a max-heap.
        other
            .f
            .total_cmp(&self.f)
            .then_with(|| other.g.cmp(&self.g))
            .then_with(|| other.city.cmp(&self.city))
    }
}

impl PartialOrd for QueueEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// I1: this is the ONE search function. UCS and A* differ only by the heuristic
/// array passed in (all zeroes = UCS). Do not split this into ucs.rs / astar.rs.
pub fn search(
    graph: &Graph,
    start: usize,
    goal: usize,
    heuristic: &[f64],
) -> Result<SearchResult, SearchError> {
    validate_graph(graph).map_err(SearchError::Graph)?;
    if start >= CITY_COUNT {
        return Err(SearchError::InvalidStart(start));
    }
    if goal >= CITY_COUNT {
        return Err(SearchError::InvalidGoal(goal));
    }
    if heuristic.len() != CITY_COUNT {
        return Err(SearchError::WrongHeuristicLength {
            expected: CITY_COUNT,
            actual: heuristic.len(),
        });
    }
    if let Some((city, _)) = heuristic
        .iter()
        .enumerate()
        .find(|(_, value)| !value.is_finite() || **value < 0.0)
    {
        return Err(SearchError::InvalidHeuristic(city));
    }
    validate_heuristic(graph, goal, heuristic)?;

    // `None` is the unvisited sentinel. `u32::MAX` would be ambiguous with a
    // real path cost of exactly u32::MAX, which `checked_add` can produce.
    let mut best: [Option<u32>; CITY_COUNT] = [None; CITY_COUNT];
    let mut parent = [usize::MAX; CITY_COUNT];
    let mut settled = [false; CITY_COUNT];
    let mut frontier = BinaryHeap::new();
    best[start] = Some(0);
    frontier.push(QueueEntry {
        f: heuristic[start],
        g: 0,
        city: start,
    });

    let mut expanded = 0usize;
    let mut generated = 1usize;
    let mut discovered = 1usize;
    let mut peak_frontier = 1usize;
    let mut peak_records = 2usize;
    let mut peak_payload = 32usize;
    let mut explored_order = Vec::new();
    let mut trace = Vec::new();
    // First candidate whose cost left u32. Remembered only to explain a failed
    // search; an unrepresentable candidate can never be on a representable
    // shortest route, so it is skipped rather than aborting a reachable goal.
    let mut overflow: Option<(usize, usize)> = None;

    while let Some(entry) = frontier.pop() {
        let current = entry.city;
        if best[current] != Some(entry.g) || settled[current] {
            continue;
        }
        settled[current] = true;
        expanded += 1;
        explored_order.push(current);
        update_peaks(
            frontier.len(),
            discovered,
            expanded,
            &mut peak_frontier,
            &mut peak_records,
            &mut peak_payload,
        );

        if current != goal {
            for &(neighbor, road_cost) in &graph[current] {
                if settled[neighbor] {
                    continue;
                }
                let Some(new_cost) = entry.g.checked_add(road_cost) else {
                    if overflow.is_none() {
                        overflow = Some((current, neighbor));
                    }
                    continue;
                };
                if best[neighbor].is_none_or(|best_cost| new_cost < best_cost) {
                    if best[neighbor].is_none() {
                        discovered += 1;
                    }
                    best[neighbor] = Some(new_cost);
                    parent[neighbor] = current;
                    frontier.push(QueueEntry {
                        f: new_cost as f64 + heuristic[neighbor],
                        g: new_cost,
                        city: neighbor,
                    });
                    generated += 1;
                    update_peaks(
                        frontier.len(),
                        discovered,
                        expanded,
                        &mut peak_frontier,
                        &mut peak_records,
                        &mut peak_payload,
                    );
                }
            }
        }

        trace.push(make_step(
            current, entry.g, &frontier, &best, &parent, &settled,
        ));

        if current == goal {
            return Ok(SearchResult {
                path: reconstruct_path(goal, &parent),
                explored_order,
                trace,
                cost: entry.g,
                expanded,
                generated,
                peak_frontier,
                peak_records,
                peak_payload_bytes: peak_payload,
            });
        }
    }
    // The frontier is exhausted without reaching the goal. If any candidate
    // overflowed, report that no representable route exists rather than
    // pretending the graph is disconnected.
    match overflow {
        Some((city, neighbor)) => Err(SearchError::CostOverflow { city, neighbor }),
        None => Err(SearchError::NoRouteExists),
    }
}

fn reconstruct_path(goal: usize, parent: &[usize]) -> Vec<usize> {
    let mut path = vec![goal];
    let mut current = goal;
    while parent[current] != usize::MAX {
        current = parent[current];
        path.push(current);
    }
    path.reverse();
    path
}

fn make_step(
    expanded_city: usize,
    expanded_cost: u32,
    frontier: &BinaryHeap<QueueEntry>,
    best: &[Option<u32>],
    parent: &[usize],
    settled: &[bool],
) -> SearchStep {
    let mut visible_frontier: Vec<_> = frontier
        .iter()
        .filter(|entry| best[entry.city] == Some(entry.g) && !settled[entry.city])
        .copied()
        .collect();
    visible_frontier.sort_by(|left, right| {
        left.f
            .total_cmp(&right.f)
            .then_with(|| left.g.cmp(&right.g))
            .then_with(|| left.city.cmp(&right.city))
    });
    visible_frontier.dedup_by_key(|entry| entry.city);

    let frontier = visible_frontier
        .into_iter()
        .map(|entry| FrontierNode {
            city: entry.city,
            cost: entry.g,
            priority: entry.f,
        })
        .collect();
    let discovered = best
        .iter()
        .enumerate()
        .filter_map(|(city, &cost)| {
            cost.map(|cost| DiscoveredNode {
                city,
                cost,
                parent: (parent[city] != usize::MAX).then_some(parent[city]),
            })
        })
        .collect();

    SearchStep {
        expanded_city,
        expanded_cost,
        frontier,
        discovered,
    }
}
