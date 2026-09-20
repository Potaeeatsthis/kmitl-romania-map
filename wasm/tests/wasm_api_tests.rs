use romania_search::graph::CITY_COUNT;
use romania_search::{search_pair, search_pair_json, PairSearchError};

#[test]
fn browser_boundary_returns_both_algorithms_for_all_pairs() {
    for start in 0..CITY_COUNT {
        for goal in 0..CITY_COUNT {
            let pair = search_pair(start, goal).expect("every city pair must have a route");
            let encoded = search_pair_json(start, goal).expect("every result must serialize");
            let json: serde_json::Value =
                serde_json::from_str(&encoded).expect("browser response must be valid JSON");

            assert_eq!(json["ucs"]["cost"].as_u64(), Some(u64::from(pair.ucs.cost)));
            assert_eq!(
                json["astar"]["cost"].as_u64(),
                Some(u64::from(pair.astar.cost))
            );
            assert_eq!(pair.ucs.cost, pair.astar.cost);
            assert_eq!(pair.ucs.trace.len(), pair.ucs.expanded);
            assert_eq!(pair.astar.trace.len(), pair.astar.expanded);
        }
    }
}

#[test]
fn browser_boundary_rejects_invalid_city_indices() {
    assert_eq!(
        search_pair(CITY_COUNT, 0),
        Err(PairSearchError::InvalidStart(CITY_COUNT))
    );
    assert_eq!(
        search_pair(0, CITY_COUNT),
        Err(PairSearchError::InvalidGoal(CITY_COUNT))
    );
}
