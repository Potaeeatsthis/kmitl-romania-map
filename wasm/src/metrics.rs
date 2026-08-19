use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct FrontierNode {
    pub city: usize,
    pub cost: u32,
    pub priority: f64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct DiscoveredNode {
    pub city: usize,
    pub cost: u32,
    pub parent: Option<usize>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct SearchStep {
    pub expanded: usize,
    pub expanded_cost: u32,
    pub frontier: Vec<FrontierNode>,
    pub discovered: Vec<DiscoveredNode>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct SearchResult {
    pub path: Vec<usize>,
    pub explored_order: Vec<usize>,
    pub trace: Vec<SearchStep>,
    pub cost: u32,
    pub expanded: usize,
    pub generated: usize,
    pub peak_frontier: usize,
    pub peak_records: usize,
    pub peak_payload_bytes: usize,
}

pub fn update_peaks(
    frontier_count: usize,
    discovered: usize,
    settled_count: usize,
    peak_frontier: &mut usize,
    peak_records: &mut usize,
    peak_payload: &mut usize,
) {
    *peak_frontier = (*peak_frontier).max(frontier_count);
    *peak_records = (*peak_records).max(frontier_count + discovered + settled_count * 2);
    // Language-neutral field payload, excluding container/object overhead and output trace.
    *peak_payload = (*peak_payload).max(frontier_count * 20 + discovered * 12 + settled_count * 5);
}
