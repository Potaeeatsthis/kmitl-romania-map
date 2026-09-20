//! Structural contracts the engine enforces before it searches or builds a
//! current-flow heuristic: a consistent heuristic anchored at the goal, and a
//! positive-weight simple graph for the effective-resistance math. These are
//! the malformed inputs that used to slip through and silently return a wrong
//! answer.

use romania_search::graph::{make_graph, GraphError, CITY_COUNT};
use romania_search::heuristics::current_flow::explain_current_flow;
use romania_search::heuristics::{current_flow_for_goal, current_flow_heuristic, HeuristicError};
use romania_search::search::{search, SearchError};

fn zeroes() -> Vec<f64> {
    vec![0.0; CITY_COUNT]
}

#[test]
fn search_accepts_the_committed_heuristic_for_every_city_pair() {
    // The gate must not reject the shipped table: all 400 pairs still search,
    // and A* still agrees with UCS on cost.
    let graph = make_graph();
    let zeroes = zeroes();

    for goal in 0..CITY_COUNT {
        let heuristic = current_flow_for_goal(goal).expect("valid embedded table");
        for start in 0..CITY_COUNT {
            let ucs = search(&graph, start, goal, &zeroes)
                .unwrap_or_else(|error| panic!("UCS {start}->{goal} rejected: {error:?}"));
            let astar = search(&graph, start, goal, heuristic)
                .unwrap_or_else(|error| panic!("A* {start}->{goal} rejected: {error:?}"));
            assert_eq!(ucs.cost, astar.cost, "{start}->{goal} cost diverged");
        }
    }
}

#[test]
fn search_rejects_an_inconsistent_heuristic() {
    let graph = make_graph();
    let mut heuristic = zeroes();
    heuristic[0] = 10_000.0;

    assert!(matches!(
        search(&graph, 1, 12, &heuristic),
        Err(SearchError::InconsistentHeuristic {
            city: 0,
            neighbor: 1
        })
    ));
}

#[test]
fn search_rejects_a_heuristic_that_is_not_zero_at_the_goal() {
    let graph = make_graph();
    let mut heuristic = zeroes();
    heuristic[12] = 1.0;

    assert!(matches!(
        search(&graph, 0, 12, &heuristic),
        Err(SearchError::GoalHeuristicNotZero(12))
    ));
}

#[test]
fn search_accepts_a_zero_weight_cycle_but_current_flow_rejects_it() {
    // Zero-cost roads are valid non-negative edges for UCS/A*, but the
    // effective-resistance construction needs a positive conductance.
    let mut graph = make_graph();
    graph[0][1] = (3, 0);
    graph[3][1] = (0, 0);

    let result =
        search(&graph, 0, 12, &zeroes()).expect("zero-cost roads are a valid search graph");
    assert_eq!(result.path.first(), Some(&0));
    assert_eq!(result.path.last(), Some(&12));

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::Graph(GraphError::ZeroWeight {
            city: 0,
            neighbor: 3
        }))
    ));
}

#[test]
fn search_reports_cost_overflow_when_no_representable_route_exists() {
    // A chain of u32::MAX roads: the second hop overflows and no representable
    // route to the far end exists, so the failure is typed as overflow rather
    // than silently dropped or misreported as disconnected.
    let mut graph = vec![Vec::new(); CITY_COUNT];
    for city in 0..CITY_COUNT - 1 {
        graph[city].push((city + 1, u32::MAX));
        graph[city + 1].push((city, u32::MAX));
    }

    assert!(matches!(
        search(&graph, 0, CITY_COUNT - 1, &zeroes()),
        Err(SearchError::CostOverflow {
            city: 1,
            neighbor: 2
        })
    ));
}

#[test]
fn search_reaches_the_goal_past_an_irrelevant_overflowing_edge() {
    // 0->1 costs 1, 0->goal costs 2, 1->2 costs u32::MAX. The overflowing 1->2
    // candidate must be skipped, not abort the search: the direct 0->2 route is
    // representable and wins.
    let mut graph = vec![Vec::new(); CITY_COUNT];
    graph[0].push((1, 1));
    graph[1].push((0, 1));
    graph[0].push((2, 2));
    graph[2].push((0, 2));
    graph[1].push((2, u32::MAX));
    graph[2].push((1, u32::MAX));

    let result = search(&graph, 0, 2, &zeroes()).expect("the direct route is representable");
    assert_eq!(result.path, vec![0, 2]);
    assert_eq!(result.cost, 2);
}

#[test]
fn search_accepts_a_cost_of_exactly_u32_max() {
    // The Option sentinel must not confuse a real u32::MAX cost with unvisited.
    let mut graph = vec![Vec::new(); CITY_COUNT];
    graph[0].push((1, u32::MAX));
    graph[1].push((0, u32::MAX));

    let result = search(&graph, 0, 1, &zeroes()).expect("u32::MAX is a representable cost");
    assert_eq!(result.path, vec![0, 1]);
    assert_eq!(result.cost, u32::MAX);
}

#[test]
fn unreachable_huge_heuristic_does_not_widen_the_tolerance() {
    // Neamt is isolated, so its heuristic entry is never consistency-checked.
    // A huge value there must not inflate the tolerance and mask a one-unit
    // inconsistency on the reachable graph, or a tiny nonzero goal.
    let mut graph = make_graph();
    graph[19].clear();
    for roads in graph.iter_mut() {
        roads.retain(|(neighbor, _)| *neighbor != 19);
    }

    let mut heuristic = zeroes();
    heuristic[19] = 1e300;
    heuristic[0] = 75.0 + heuristic[1] + 1.0;
    assert!(matches!(
        search(&graph, 0, 12, &heuristic),
        Err(SearchError::InconsistentHeuristic {
            city: 0,
            neighbor: 1
        })
    ));

    let mut masked_goal = zeroes();
    masked_goal[19] = 1e300;
    masked_goal[12] = 1e-5;
    assert!(matches!(
        search(&graph, 0, 12, &masked_goal),
        Err(SearchError::GoalHeuristicNotZero(12))
    ));
}

#[test]
fn search_accepts_a_scale_aware_heuristic_on_a_large_star() {
    // 49 * 2^20: the reciprocal-inversion overshoot (~7.5e-9) exceeds a flat
    // 1e-9 tolerance, so this only passes because the tolerance scales with the
    // weight magnitude.
    const WEIGHT: u32 = 49 * (1 << 20);
    let mut graph = vec![Vec::new(); CITY_COUNT];
    for leaf in 1..CITY_COUNT {
        graph[0].push((leaf, WEIGHT));
        graph[leaf].push((0, WEIGHT));
    }

    let heuristic = current_flow_heuristic(&graph, 0)
        .expect("a star is a valid resistive graph")
        .values;
    assert!(
        heuristic[1] - f64::from(WEIGHT) > 1e-9,
        "the stress case must actually overshoot a flat 1e-9 tolerance"
    );
    search(&graph, 1, 0, &heuristic).expect("the solver's own heuristic must be accepted");

    let mut broken = heuristic.clone();
    broken[1] += 1.0;
    assert!(matches!(
        search(&graph, 1, 0, &broken),
        Err(SearchError::InconsistentHeuristic {
            city: 1,
            neighbor: 0
        })
    ));
}

#[test]
fn search_handles_a_start_equal_to_its_goal() {
    let graph = make_graph();
    let result = search(&graph, 7, 7, &zeroes()).expect("same city is a trivial route");

    assert_eq!(result.path, vec![7]);
    assert_eq!(result.cost, 0);
    assert_eq!(result.expanded, 1);
}

#[test]
fn search_reports_no_route_on_a_disconnected_graph() {
    let mut graph = make_graph();
    graph[19].clear();
    for roads in graph.iter_mut() {
        roads.retain(|(neighbor, _)| *neighbor != 19);
    }

    assert!(matches!(
        search(&graph, 0, 19, &zeroes()),
        Err(SearchError::NoRouteExists)
    ));
}

#[test]
fn current_flow_rejects_invalid_start_and_goal() {
    let graph = make_graph();

    assert!(matches!(
        explain_current_flow(&graph, CITY_COUNT, 0),
        Err(HeuristicError::InvalidStart(CITY_COUNT))
    ));
    assert!(matches!(
        explain_current_flow(&graph, 0, CITY_COUNT),
        Err(HeuristicError::InvalidGoal(CITY_COUNT))
    ));
    assert!(matches!(
        current_flow_heuristic(&graph, CITY_COUNT),
        Err(HeuristicError::InvalidGoal(CITY_COUNT))
    ));
}

#[test]
fn current_flow_rejects_a_directed_graph() {
    let mut graph = make_graph();
    graph[0].retain(|(neighbor, _)| *neighbor != 1);

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::Graph(GraphError::AsymmetricEdge {
            city: 1,
            neighbor: 0
        }))
    ));
}

#[test]
fn current_flow_rejects_a_mismatched_reverse_weight() {
    let mut graph = make_graph();
    let road = graph[0]
        .iter_mut()
        .find(|(neighbor, _)| *neighbor == 1)
        .expect("Arad-Zerind exists");
    road.1 = 76;

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::Graph(GraphError::MismatchedEdgeWeight {
            city: 0,
            neighbor: 1,
            forward: 76,
            reverse: 75
        }))
    ));
}

#[test]
fn current_flow_rejects_a_self_loop() {
    let mut graph = make_graph();
    graph[0].push((0, 10));

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::Graph(GraphError::SelfLoop { city: 0 }))
    ));
}

#[test]
fn current_flow_rejects_a_duplicate_edge() {
    let mut graph = make_graph();
    graph[0].push((1, 75));

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::Graph(GraphError::DuplicateEdge {
            city: 0,
            neighbor: 1
        }))
    ));
}

#[test]
fn current_flow_reports_a_disconnected_resistive_graph() {
    // Neamt is a leaf; removing Iasi-Neamt both ways keeps the graph undirected
    // but disconnects Neamt, leaving a zero row in the grounded Laplacian.
    let mut graph = make_graph();
    graph[18].retain(|(neighbor, _)| *neighbor != 19);
    graph[19].retain(|(neighbor, _)| *neighbor != 18);

    assert!(matches!(
        current_flow_heuristic(&graph, 12),
        Err(HeuristicError::DisconnectedGraph)
    ));
}
