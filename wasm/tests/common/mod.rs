use romania_search::graph::Graph;

pub fn independent_shortest_costs(graph: &Graph, start: usize) -> Vec<u32> {
    let mut distances = vec![u32::MAX; graph.len()];
    let mut visited = vec![false; graph.len()];
    distances[start] = 0;

    for _ in 0..graph.len() {
        let current = (0..graph.len())
            .filter(|&city| !visited[city])
            .min_by_key(|&city| distances[city]);
        let Some(current) = current else {
            break;
        };
        if distances[current] == u32::MAX {
            break;
        }
        visited[current] = true;

        for &(neighbor, road_cost) in &graph[current] {
            if visited[neighbor] {
                continue;
            }
            let candidate = distances[current] + road_cost;
            distances[neighbor] = distances[neighbor].min(candidate);
        }
    }

    distances
}
// Each integration-test file compiles this shared module separately.
#[allow(dead_code)]
pub fn path_cost(graph: &Graph, path: &[usize]) -> Option<u32> {
    path.windows(2).try_fold(0, |total, road| {
        graph[road[0]]
            .iter()
            .find(|(neighbor, _)| *neighbor == road[1])
            .map(|(_, distance)| total + distance)
    })
}
