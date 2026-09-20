use std::time::Instant;

use serde::Serialize;

use romania_search::graph::{make_graph, Graph, CITY_COUNT};
use romania_search::heuristics::current_flow::current_flow_for_goal;
use romania_search::search::search;

/// One untimed call before the timed loop begins, matching cli.rs's warmup pattern.
const WARMUP_RUNS: usize = 1;
/// Individually-timed repeat runs per pair per algorithm; the median of these is reported.
const TIMED_RUNS: usize = 1000;

/// Export-layer only. Deliberately not part of metrics::SearchResult -- I1/I4 keep
/// timing out of the engine and out of search(), exactly like cli.rs's benchmark().
#[derive(Serialize)]
struct PairRuntime {
    start: usize,
    goal: usize,
    ucs_runtime_us: f64,
    astar_runtime_us: f64,
}

#[derive(Serialize)]
struct AllRuntimes {
    schema_version: u8,
    city_count: usize,
    pair_count: usize,
    pairs: Vec<PairRuntime>,
}

fn timed_median_us(graph: &Graph, start: usize, goal: usize, heuristic: &[f64]) -> f64 {
    for _ in 0..WARMUP_RUNS {
        search(graph, start, goal, heuristic)
            .unwrap_or_else(|error| panic!("warmup search failed for {start}->{goal}: {error:?}"));
    }

    let mut samples_us = Vec::with_capacity(TIMED_RUNS);
    for _ in 0..TIMED_RUNS {
        let began = Instant::now();
        search(graph, start, goal, heuristic)
            .unwrap_or_else(|error| panic!("timed search failed for {start}->{goal}: {error:?}"));
        samples_us.push(began.elapsed().as_secs_f64() * 1_000_000.0);
    }

    samples_us.sort_by(f64::total_cmp);
    let mid = samples_us.len() / 2;
    if samples_us.len() % 2 == 0 {
        (samples_us[mid - 1] + samples_us[mid]) / 2.0
    } else {
        samples_us[mid]
    }
}

fn main() {
    let graph = make_graph();
    let zeroes = [0.0; CITY_COUNT];
    let mut pairs = Vec::with_capacity(CITY_COUNT * CITY_COUNT);

    for start in 0..CITY_COUNT {
        for goal in 0..CITY_COUNT {
            let heuristic = current_flow_for_goal(goal).unwrap_or_else(|error| {
                panic!("heuristic lookup failed for goal {goal}: {error:?}")
            });

            let ucs_runtime_us = timed_median_us(&graph, start, goal, &zeroes);
            let astar_runtime_us = timed_median_us(&graph, start, goal, heuristic);

            pairs.push(PairRuntime {
                start,
                goal,
                ucs_runtime_us,
                astar_runtime_us,
            });
        }
    }

    let all_runtimes = AllRuntimes {
        schema_version: 1,
        city_count: CITY_COUNT,
        pair_count: pairs.len(),
        pairs,
    };

    println!(
        "{}",
        serde_json::to_string_pretty(&all_runtimes).expect("all-runtimes data must serialize")
    );
}
