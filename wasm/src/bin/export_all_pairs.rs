use serde::Serialize;

use romania_search::graph::{CITIES, CITY_COUNT};
use romania_search::metrics::SearchResult;
use romania_search::{search_pair, SearchPair};

#[derive(Serialize)]
struct City {
    id: usize,
    name: &'static str,
}

#[derive(Serialize)]
struct Pair {
    start: usize,
    goal: usize,
    ucs: SearchResult,
    astar: SearchResult,
}

#[derive(Serialize)]
struct AllPairs {
    schema_version: u8,
    city_count: usize,
    pair_count: usize,
    includes_same_city_pairs: bool,
    cities: Vec<City>,
    pairs: Vec<Pair>,
}

fn main() {
    let cities = CITIES
        .iter()
        .enumerate()
        .map(|(id, &name)| City { id, name })
        .collect();
    let mut pairs = Vec::with_capacity(CITY_COUNT * CITY_COUNT);

    for start in 0..CITY_COUNT {
        for goal in 0..CITY_COUNT {
            let SearchPair { ucs, astar } = search_pair(start, goal)
                .unwrap_or_else(|error| panic!("search failed for pair {start}->{goal}: {error}"));
            pairs.push(Pair {
                start,
                goal,
                ucs,
                astar,
            });
        }
    }

    let all_pairs = AllPairs {
        schema_version: 1,
        city_count: CITY_COUNT,
        pair_count: pairs.len(),
        includes_same_city_pairs: true,
        cities,
        pairs,
    };

    println!(
        "{}",
        serde_json::to_string_pretty(&all_pairs).expect("all-pairs data must serialize")
    );
}
