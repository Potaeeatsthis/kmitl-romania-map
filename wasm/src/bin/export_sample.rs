use serde::Serialize;

use romania_search::metrics::SearchResult;
use romania_search::{search_pair, SearchPair};

const START: usize = 0; // Arad
const GOAL: usize = 12; // Bucharest

#[derive(Serialize)]
struct Sample {
    ucs: SearchResult,
    astar: SearchResult,
}

fn main() {
    let SearchPair { ucs, astar } =
        search_pair(START, GOAL).expect("both searches must find a route from Arad to Bucharest");
    let sample = Sample { ucs, astar };

    println!(
        "{}",
        serde_json::to_string_pretty(&sample).expect("sample result must serialize")
    );
}
