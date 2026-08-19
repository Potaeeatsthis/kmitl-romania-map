use std::cmp::Ordering;
use std::collections::BinaryHeap;

use crate::graph::{Graph, CITY_COUNT};
use crate::metrics::{update_peaks, SearchResult};

/// I5/I4: this module never panics. A route failure is a value, not a crash,
/// because a panic inside the wasm module takes the whole page down with it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchError {
    InvalidGraphSize { expected: usize, actual: usize },
    InvalidStart(usize),
    InvalidGoal(usize),
    WrongHeuristicLength { expected: usize, actual: usize },
    InvalidHeuristic(usize),
    InvalidNeighbor { city: usize, neighbor: usize },
    NoRouteExists,
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
    if graph.len() != CITY_COUNT {
        return Err(SearchError::InvalidGraphSize {
            expected: CITY_COUNT,
            actual: graph.len(),
        });
    }
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

    let mut best = [u32::MAX; CITY_COUNT];
    let mut parent = [usize::MAX; CITY_COUNT];
    let mut settled = [false; CITY_COUNT];
    let mut frontier = BinaryHeap::new();
    best[start] = 0;
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

    while let Some(entry) = frontier.pop() {
        let current = entry.city;
        if entry.g != best[current] || settled[current] {
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

        if current == goal {
            let mut path = Vec::new();
            let mut node = goal;
            loop {
                path.push(node);
                if parent[node] == usize::MAX {
                    break;
                }
                node = parent[node];
            }
            path.reverse();
            return Ok(SearchResult {
                path,
                explored_order,
                cost: entry.g,
                expanded,
                generated,
                peak_frontier,
                peak_records,
                peak_payload_bytes: peak_payload,
            });
        }

        for &(neighbor, road_cost) in &graph[current] {
            if neighbor >= CITY_COUNT {
                return Err(SearchError::InvalidNeighbor {
                    city: current,
                    neighbor,
                });
            }
            if settled[neighbor] {
                continue;
            }
            let Some(new_cost) = entry.g.checked_add(road_cost) else {
                continue;
            };
            if new_cost < best[neighbor] {
                if best[neighbor] == u32::MAX {
                    discovered += 1;
                }
                best[neighbor] = new_cost;
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
    Err(SearchError::NoRouteExists)
}
