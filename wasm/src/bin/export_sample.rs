use serde::Serialize;

use romania_search::graph::{make_graph, CITY_COUNT};
use romania_search::heuristics::current_flow::current_flow_for_goal;
use romania_search::metrics::SearchResult;
use romania_search::search::search;

const START: usize = 0; // Arad
const GOAL: usize = 12; // Bucharest

#[derive(Serialize)]
struct Sample {
    ucs: SearchResult,
    astar: SearchResult,
}

fn main() {
    let graph = make_graph();
    let zeroes = [0.0; CITY_COUNT];
    let ucs =
        search(&graph, START, GOAL, &zeroes).expect("UCS must find a route from Arad to Bucharest");

    let heuristic =
        current_flow_for_goal(GOAL).expect("Bucharest must have an embedded heuristic table");
    let astar = search(&graph, START, GOAL, heuristic)
        .expect("A* must find a route from Arad to Bucharest");

    let sample = Sample { ucs, astar };
    println!(
        "{}",
        serde_json::to_string_pretty(&sample).expect("sample result must serialize")
    );
}
