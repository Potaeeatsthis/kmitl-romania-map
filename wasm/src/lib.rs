pub mod graph;
pub mod heuristics;
pub mod metrics;
pub mod search;

use std::fmt;

use serde::Serialize;

use graph::{make_graph, CITY_COUNT};
use heuristics::current_flow::{current_flow_for_goal, HeuristicError};
use metrics::SearchResult;
use search::{search, SearchError};

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct SearchPair {
    pub ucs: SearchResult,
    pub astar: SearchResult,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PairSearchError {
    InvalidStart(usize),
    InvalidGoal(usize),
    Heuristic(HeuristicError),
    Ucs(SearchError),
    Astar(SearchError),
    Serialization,
}

impl fmt::Display for PairSearchError {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Self::InvalidStart(city) => write!(formatter, "invalid start city index: {city}"),
            Self::InvalidGoal(city) => write!(formatter, "invalid destination city index: {city}"),
            Self::Heuristic(error) => write!(formatter, "heuristic lookup failed: {error:?}"),
            Self::Ucs(error) => write!(formatter, "UCS search failed: {error:?}"),
            Self::Astar(error) => write!(formatter, "A* search failed: {error:?}"),
            Self::Serialization => formatter.write_str("search result could not be serialized"),
        }
    }
}

impl std::error::Error for PairSearchError {}

/// Run both algorithms through the same search implementation.
/// UCS receives an all-zero heuristic; A* receives the embedded current-flow table.
pub fn search_pair(start: usize, goal: usize) -> Result<SearchPair, PairSearchError> {
    if start >= CITY_COUNT {
        return Err(PairSearchError::InvalidStart(start));
    }
    if goal >= CITY_COUNT {
        return Err(PairSearchError::InvalidGoal(goal));
    }

    let graph = make_graph();
    let zeroes = [0.0; CITY_COUNT];
    let ucs = search(&graph, start, goal, &zeroes).map_err(PairSearchError::Ucs)?;
    let heuristic = current_flow_for_goal(goal).map_err(PairSearchError::Heuristic)?;
    let astar = search(&graph, start, goal, heuristic).map_err(PairSearchError::Astar)?;

    Ok(SearchPair { ucs, astar })
}

pub fn search_pair_json(start: usize, goal: usize) -> Result<String, PairSearchError> {
    serde_json::to_string(&search_pair(start, goal)?).map_err(|_| PairSearchError::Serialization)
}

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = searchPairJson)]
pub fn search_pair_json_wasm(start: usize, goal: usize) -> Result<String, JsValue> {
    search_pair_json(start, goal).map_err(|error| JsValue::from_str(&error.to_string()))
}
