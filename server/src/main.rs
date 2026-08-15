use std::cmp::Ordering;
use std::collections::BinaryHeap;
use std::hint::black_box;
use std::io::{self, Write};
use std::time::Instant;

const CITY_COUNT: usize = 20;
const BENCHMARK_RUNS: usize = 5_000;

const CITIES: [&str; CITY_COUNT] = [
    "Arad", "Zerind", "Oradea", "Sibiu", "Timisoara", "Lugoj",
    "Mehadia", "Drobeta", "Craiova", "Rimnicu Vilcea", "Pitesti",
    "Fagaras", "Bucharest", "Giurgiu", "Urziceni", "Hirsova",
    "Eforie", "Vaslui", "Iasi", "Neamt",
];

type Graph = Vec<Vec<(usize, u32)>>;

fn make_graph() -> Graph {
    let roads: [(usize, usize, u32); 23] = [
        (0, 1, 75), (1, 2, 71), (2, 3, 151), (0, 3, 140),
        (0, 4, 118), (4, 5, 111), (5, 6, 70), (6, 7, 75),
        (7, 8, 120), (8, 9, 146), (8, 10, 138), (3, 9, 80),
        (3, 11, 99), (9, 10, 97), (11, 12, 211), (10, 12, 101),
        (12, 13, 90), (12, 14, 85), (14, 15, 98), (15, 16, 86),
        (14, 17, 142), (17, 18, 92), (18, 19, 87),
    ];
    let mut graph = vec![Vec::new(); CITY_COUNT];
    for (a, b, distance) in roads {
        graph[a].push((b, distance));
        graph[b].push((a, distance));
    }
    graph
}

#[derive(Clone)]
struct SearchResult {
    path: Vec<usize>,
    explored_order: Vec<usize>,
    cost: u32,
    expanded: usize,
    generated: usize,
    peak_frontier: usize,
    peak_records: usize,
    peak_payload_bytes: usize,
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
        other.f.total_cmp(&self.f)
            .then_with(|| other.g.cmp(&self.g))
            .then_with(|| other.city.cmp(&self.city))
    }
}

impl PartialOrd for QueueEntry {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

fn search(graph: &Graph, start: usize, goal: usize, heuristic: &[f64]) -> SearchResult {
    let mut best = [u32::MAX; CITY_COUNT];
    let mut parent = [usize::MAX; CITY_COUNT];
    let mut settled = [false; CITY_COUNT];
    let mut frontier = BinaryHeap::new();
    best[start] = 0;
    frontier.push(QueueEntry { f: heuristic[start], g: 0, city: start });

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
            frontier.len(), discovered, expanded,
            &mut peak_frontier, &mut peak_records, &mut peak_payload,
        );

        if current == goal {
            let mut path = Vec::new();
            let mut node = goal;
            loop {
                path.push(node);
                if parent[node] == usize::MAX { break; }
                node = parent[node];
            }
            path.reverse();
            return SearchResult {
                path,
                explored_order,
                cost: entry.g,
                expanded,
                generated,
                peak_frontier,
                peak_records,
                peak_payload_bytes: peak_payload,
            };
        }

        for &(neighbor, road_cost) in &graph[current] {
            if settled[neighbor] { continue; }
            let new_cost = entry.g + road_cost;
            if new_cost < best[neighbor] {
                if best[neighbor] == u32::MAX { discovered += 1; }
                best[neighbor] = new_cost;
                parent[neighbor] = current;
                frontier.push(QueueEntry {
                    f: new_cost as f64 + heuristic[neighbor],
                    g: new_cost,
                    city: neighbor,
                });
                generated += 1;
                update_peaks(
                    frontier.len(), discovered, expanded,
                    &mut peak_frontier, &mut peak_records, &mut peak_payload,
                );
            }
        }
    }
    panic!("No route exists between the selected cities");
}

fn update_peaks(
    frontier_count: usize,
    discovered: usize,
    settled_count: usize,
    peak_frontier: &mut usize,
    peak_records: &mut usize,
    peak_payload: &mut usize,
) {
    *peak_frontier = (*peak_frontier).max(frontier_count);
    *peak_records = (*peak_records).max(frontier_count + discovered + settled_count * 2);
    // Language-neutral field payload, excluding container/object overhead.
    *peak_payload = (*peak_payload).max(
        frontier_count * 20 + discovered * 12 + settled_count * 5,
    );
}

struct HeuristicResult {
    values: Vec<f64>,
    logical_workspace_bytes: usize,
}

fn current_flow_heuristic(graph: &Graph, goal: usize) -> HeuristicResult {
    let mut laplacian = vec![vec![0.0; CITY_COUNT]; CITY_COUNT];
    for a in 0..CITY_COUNT {
        for &(b, distance) in &graph[a] {
            let conductance = 1.0 / distance as f64;
            laplacian[a][a] += conductance;
            laplacian[a][b] -= conductance;
        }
    }

    let kept: Vec<usize> = (0..CITY_COUNT).filter(|&city| city != goal).collect();
    let n = CITY_COUNT - 1;
    let mut augmented = vec![vec![0.0; 2 * n]; n];
    for i in 0..n {
        for j in 0..n {
            augmented[i][j] = laplacian[kept[i]][kept[j]];
        }
        augmented[i][n + i] = 1.0;
    }

    for column in 0..n {
        let mut pivot = column;
        for row in (column + 1)..n {
            if augmented[row][column].abs() > augmented[pivot][column].abs() {
                pivot = row;
            }
        }
        if augmented[pivot][column].abs() < 1e-14 {
            panic!("The road graph must be connected");
        }
        augmented.swap(column, pivot);
        let divisor = augmented[column][column];
        for value in &mut augmented[column] {
            *value /= divisor;
        }
        for row in 0..n {
            if row == column { continue; }
            let factor = augmented[row][column];
            if factor == 0.0 { continue; }
            for j in 0..(2 * n) {
                augmented[row][j] -= factor * augmented[column][j];
            }
        }
    }

    let mut values = vec![0.0; CITY_COUNT];
    for i in 0..n {
        // Diagonal of the inverse grounded Laplacian is R_eff(city, goal).
        values[kept[i]] = augmented[i][n + i].max(0.0);
    }
    let workspace = CITY_COUNT * CITY_COUNT * 8 + n * (2 * n) * 8 + CITY_COUNT * 8;
    HeuristicResult { values, logical_workspace_bytes: workspace }
}

fn benchmark(
    graph: &Graph,
    start: usize,
    goal: usize,
    heuristic: &[f64],
) -> (SearchResult, f64) {
    let result = search(graph, start, goal, heuristic);
    let mut checksum = 0usize;
    let began = Instant::now();
    for _ in 0..BENCHMARK_RUNS {
        let measured = search(graph, start, goal, heuristic);
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
    let heuristic = current_flow_heuristic(&graph, goal);
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
