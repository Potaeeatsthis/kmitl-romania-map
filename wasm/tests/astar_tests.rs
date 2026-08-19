mod common;

use romania_search::graph::{make_graph, Graph, CITIES};
use romania_search::heuristics::current_flow_for_goal;
use romania_search::metrics::SearchResult;
use romania_search::search::{search, SearchError};

use common::{independent_shortest_costs, path_cost};

fn ucs(graph: &Graph, start: usize, goal: usize) -> Result<SearchResult, SearchError> {
    let zeroes = vec![0.0; graph.len()];
    search(graph, start, goal, &zeroes)
}

fn current_flow_astar(
    graph: &Graph,
    start: usize,
    goal: usize,
) -> Result<SearchResult, SearchError> {
    let heuristic = current_flow_for_goal(goal).map_err(|_| SearchError::InvalidGoal(goal))?;
    search(graph, start, goal, heuristic)
}

#[test]
fn current_flow_astar_finds_the_known_optimal_route() {
    let graph = make_graph();
    let result = current_flow_astar(&graph, 0, 12).expect("Arad must reach Bucharest");

    assert_eq!(result.path, vec![0, 3, 9, 10, 12]);
    assert_eq!(result.cost, 418);
    assert_eq!(result.expanded, 9);
    assert_eq!(result.trace.len(), result.expanded);
}

#[test]
fn current_flow_astar_is_optimal_for_every_city_pair() {
    let graph = make_graph();
    let mut ucs_expanded = 0;
    let mut astar_expanded = 0;

    for (start, start_name) in CITIES.iter().enumerate() {
        let expected = independent_shortest_costs(&graph, start);
        for (goal, &expected_cost) in expected.iter().enumerate() {
            let astar = current_flow_astar(&graph, start, goal).unwrap_or_else(|error| {
                panic!("{start_name} -> {} failed: {error:?}", CITIES[goal])
            });
            let ucs_result = ucs(&graph, start, goal).expect("connected graph");

            assert_eq!(
                astar.cost, expected_cost,
                "wrong cost for {} -> {}",
                start_name, CITIES[goal]
            );
            assert_eq!(astar.path.first(), Some(&start));
            assert_eq!(astar.path.last(), Some(&goal));
            assert_eq!(path_cost(&graph, &astar.path), Some(astar.cost));
            assert_eq!(astar.trace.len(), astar.expanded);

            ucs_expanded += ucs_result.expanded;
            astar_expanded += astar.expanded;
        }
    }

    assert_eq!(ucs_expanded, 4_200);
    assert_eq!(astar_expanded, 2_436);
    assert!(
        astar_expanded < ucs_expanded,
        "A* should expand fewer cities overall ({astar_expanded} vs {ucs_expanded})"
    );
}
