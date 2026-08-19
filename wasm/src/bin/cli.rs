use std::hint::black_box;
use std::io::{self, Write};
use std::time::Instant;

use romania_search::graph::{make_graph, Graph, CITIES, CITY_COUNT};
use romania_search::heuristics::current_flow_heuristic;
use romania_search::metrics::SearchResult;
use romania_search::search::search;

const BENCHMARK_RUNS: usize = 5_000;

fn benchmark(graph: &Graph, start: usize, goal: usize, heuristic: &[f64]) -> (SearchResult, f64) {
    let result = search(graph, start, goal, heuristic)
        .expect("no route exists between the selected cities");
    let mut checksum = 0usize;
    let began = Instant::now();
    for _ in 0..BENCHMARK_RUNS {
        let measured = search(graph, start, goal, heuristic)
            .expect("no route exists between the selected cities");
        checksum ^= measured.cost as usize + measured.expanded;
    }
    let elapsed_us = began.elapsed().as_secs_f64() * 1_000_000.0;
    black_box(checksum);
    (result, elapsed_us / BENCHMARK_RUNS as f64)
}

fn select_city(prompt: &str) -> usize {
    loop {
        print!("{prompt}");
        io::stdout().flush().expect("failed to flush output");
        let mut answer = String::new();
        if io::stdin().read_line(&mut answer).expect("failed to read input") == 0 {
            panic!("Input ended");
        }
        if let Some(city) = CITIES.iter().position(|name| name.eq_ignore_ascii_case(answer.trim())) {
            return city;
        }
        println!("Unknown city. Enter one of the names shown above.");
    }
}

fn path_text(result: &SearchResult) -> String {
    result.path.iter().map(|&city| CITIES[city]).collect::<Vec<_>>().join(" -> ")
}

fn explored_text(result: &SearchResult) -> String {
    result.explored_order.iter().map(|&city| CITIES[city]).collect::<Vec<_>>().join(" -> ")
}

fn print_row(name: &str, result: &SearchResult, time_us: f64) {
    println!(
        "{:<18}{:>14.3}{:>11}{:>11}{:>12}{:>14}{:>14}",
        name,
        time_us,
        result.expanded,
        result.generated,
        result.peak_frontier,
        result.peak_records,
        result.peak_payload_bytes,
    );
}

fn main() {
    let graph = make_graph();
    println!("Romania map (20 cities):");
    println!("{}", CITIES.join(", "));
    let start = select_city("Current city: ");
    let goal = select_city("Goal city: ");

    let build_start = Instant::now();
    let heuristic = current_flow_heuristic(&graph, goal)
        .expect("the road graph must be connected");
    let build_us = build_start.elapsed().as_secs_f64() * 1_000_000.0;

    let zeroes = vec![0.0; CITY_COUNT];
    let (ucs, ucs_us) = benchmark(&graph, start, goal, &zeroes);
    let (astar, astar_us) = benchmark(&graph, start, goal, &heuristic.values);

    println!("\nRoutes");
    println!("UCS:             {} (cost {} km)", path_text(&ucs), ucs.cost);
    println!("Current-flow A*: {} (cost {} km)", path_text(&astar), astar.cost);
    println!("\nExplored order");
    println!("UCS:             {}", explored_text(&ucs));
    println!("Current-flow A*: {}", explored_text(&astar));
    println!("\nAverage search time over {BENCHMARK_RUNS} runs (heuristic build excluded)");
    println!(
        "{:<18}{:>14}{:>11}{:>11}{:>12}{:>14}{:>14}",
        "Algorithm", "Runtime (us)", "Expanded", "Generated", "Peak queue", "Peak records", "Memory (B)"
    );
    print_row("UCS", &ucs, ucs_us);
    print_row("Current-flow A*", &astar, astar_us);
    println!(
        "\nA* heuristic build: {:.3} us; logical numeric workspace: {} bytes",
        build_us, heuristic.logical_workspace_bytes
    );
    println!("Units: runtime is microseconds (us); logical search memory is bytes (B).");
    println!("Memory is a language-neutral count of stored fields; runtime/container overhead is excluded.");
    if ucs.cost == astar.cost {
        println!("Both algorithms found the same optimal route cost.");
    }
}
