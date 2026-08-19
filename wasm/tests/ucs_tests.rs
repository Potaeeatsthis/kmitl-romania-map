mod common;

use romania_search::graph::{make_graph, Graph, CITIES, CITY_COUNT};
use romania_search::metrics::SearchResult;
use romania_search::search::{search, SearchError};

use common::{independent_shortest_costs, path_cost};

fn ucs(graph: &Graph, start: usize, goal: usize) -> Result<SearchResult, SearchError> {
    let zeroes = vec![0.0; graph.len()];
    search(graph, start, goal, &zeroes)
}

#[test]
fn ucs_finds_the_known_optimal_route() {
    let graph = make_graph();
    let result = ucs(&graph, 0, 12).expect("Arad must reach Bucharest");

    assert_eq!(result.path, vec![0, 3, 9, 10, 12]);
    assert_eq!(result.cost, 418);
    assert_eq!(result.expanded, 13);
}

#[test]
fn ucs_matches_an_independent_solver_for_every_city_pair() {
    let graph = make_graph();

    for (start, start_name) in CITIES.iter().enumerate() {
        let expected = independent_shortest_costs(&graph, start);
        for (goal, &expected_cost) in expected.iter().enumerate() {
            let result = ucs(&graph, start, goal).unwrap_or_else(|error| {
                panic!("{start_name} -> {} failed: {error:?}", CITIES[goal])
            });
            assert_eq!(
                result.cost, expected_cost,
                "wrong cost for {} -> {}",
                start_name, CITIES[goal]
            );
            assert_eq!(result.path.first(), Some(&start));
            assert_eq!(result.path.last(), Some(&goal));
            assert_eq!(path_cost(&graph, &result.path), Some(result.cost));
        }
    }
}

#[test]
fn trace_records_one_complete_frame_per_expansion() {
    let graph = make_graph();
    let result = ucs(&graph, 0, 12).expect("search should succeed");

    assert_eq!(result.trace.len(), result.expanded);
    assert_eq!(
        result
            .trace
            .iter()
            .map(|step| step.expanded_city)
            .collect::<Vec<_>>(),
        result.explored_order
    );

    let first = &result.trace[0];
    assert_eq!(first.expanded_city, 0);
    assert_eq!(first.expanded_cost, 0);
    assert_eq!(
        first
            .frontier
            .iter()
            .map(|node| (node.city, node.cost))
            .collect::<Vec<_>>(),
        vec![(1, 75), (4, 118), (3, 140)]
    );
    assert_eq!(
        first
            .discovered
            .iter()
            .map(|node| (node.city, node.cost, node.parent))
            .collect::<Vec<_>>(),
        vec![
            (0, 0, None),
            (1, 75, Some(0)),
            (3, 140, Some(0)),
            (4, 118, Some(0)),
        ]
    );

    let last = result
        .trace
        .last()
        .expect("trace must contain the goal frame");
    assert_eq!(last.expanded_city, 12);
    assert_eq!(last.expanded_cost, 418);
    assert!(last.frontier.iter().all(|node| node.city != 12));
}

#[test]
fn invalid_inputs_return_errors_instead_of_panicking() {
    let graph = make_graph();
    let zeroes = vec![0.0; CITY_COUNT];

    assert!(matches!(
        search(&graph, CITY_COUNT, 0, &zeroes),
        Err(SearchError::InvalidStart(CITY_COUNT))
    ));
    assert!(matches!(
        search(&graph, 0, CITY_COUNT, &zeroes),
        Err(SearchError::InvalidGoal(CITY_COUNT))
    ));
    assert!(matches!(
        search(&graph, 0, 12, &zeroes[..CITY_COUNT - 1]),
        Err(SearchError::WrongHeuristicLength {
            expected: CITY_COUNT,
            actual
        }) if actual == CITY_COUNT - 1
    ));

    let mut invalid_heuristic = zeroes.clone();
    invalid_heuristic[3] = f64::NAN;
    assert!(matches!(
        search(&graph, 0, 12, &invalid_heuristic),
        Err(SearchError::InvalidHeuristic(3))
    ));

    let short_graph = vec![Vec::new(); CITY_COUNT - 1];
    assert!(matches!(
        search(&short_graph, 0, 1, &zeroes),
        Err(SearchError::InvalidGraphSize {
            expected: CITY_COUNT,
            actual
        }) if actual == CITY_COUNT - 1
    ));

    let mut invalid_graph = make_graph();
    invalid_graph[0].push((CITY_COUNT, 1));
    assert!(matches!(
        search(&invalid_graph, 0, 12, &zeroes),
        Err(SearchError::InvalidNeighbor {
            city: 0,
            neighbor: CITY_COUNT
        })
    ));
}
