mod common;

use romania_search::graph::{make_graph, CITY_COUNT};
use romania_search::heuristics::{current_flow_for_goal, current_flow_heuristic, HeuristicError};

use common::independent_shortest_costs;

const EPSILON: f64 = 1e-8;

#[test]
fn current_flow_table_is_admissible_and_zero_at_every_goal() {
    let graph = make_graph();

    for goal in 0..CITY_COUNT {
        let heuristic = current_flow_for_goal(goal).expect("valid embedded table");
        assert!(heuristic[goal].abs() <= EPSILON);

        for (start, &estimate) in heuristic.iter().enumerate() {
            let shortest = independent_shortest_costs(&graph, start)[goal] as f64;
            assert!(
                estimate <= shortest + EPSILON,
                "goal {goal}, city {start}: {} > {shortest}",
                estimate
            );
        }
    }
}

#[test]
fn current_flow_table_is_consistent_on_every_road() {
    let graph = make_graph();

    for goal in 0..CITY_COUNT {
        let heuristic = current_flow_for_goal(goal).expect("valid embedded table");
        for (from, roads) in graph.iter().enumerate() {
            for &(to, distance) in roads {
                assert!(
                    heuristic[from] <= distance as f64 + heuristic[to] + EPSILON,
                    "goal {goal}, edge {from}->{to} is inconsistent"
                );
            }
        }
    }
}

#[test]
fn embedded_table_matches_runtime_heuristic() {
    let graph = make_graph();

    for goal in 0..CITY_COUNT {
        let embedded = current_flow_for_goal(goal).expect("valid embedded table");
        let runtime = current_flow_heuristic(&graph, goal).expect("connected graph");

        for (city, (&embedded_value, &runtime_value)) in
            embedded.iter().zip(runtime.values.iter()).enumerate()
        {
            assert!(
                (embedded_value - runtime_value).abs() <= EPSILON,
                "goal {goal}, city {city}: embedded {embedded_value} != runtime {runtime_value}"
            );
        }
    }
}

#[test]
fn embedded_table_rejects_an_invalid_goal() {
    assert!(matches!(
        current_flow_for_goal(CITY_COUNT),
        Err(HeuristicError::InvalidGoal(CITY_COUNT))
    ));
}
