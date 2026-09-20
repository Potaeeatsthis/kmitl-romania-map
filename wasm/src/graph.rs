pub const CITY_COUNT: usize = 20;

pub const CITIES: [&str; CITY_COUNT] = [
    "Arad",
    "Zerind",
    "Oradea",
    "Sibiu",
    "Timisoara",
    "Lugoj",
    "Mehadia",
    "Drobeta",
    "Craiova",
    "Rimnicu Vilcea",
    "Pitesti",
    "Fagaras",
    "Bucharest",
    "Giurgiu",
    "Urziceni",
    "Hirsova",
    "Eforie",
    "Vaslui",
    "Iasi",
    "Neamt",
];

pub type Graph = Vec<Vec<(usize, u32)>>;

/// Structural problems in an adjacency list. One shared error type, so the
/// search engine and the effective-resistance heuristic reject the same
/// malformed input the same way instead of each re-deriving its own checks.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphError {
    InvalidGraphSize {
        expected: usize,
        actual: usize,
    },
    InvalidNeighbor {
        city: usize,
        neighbor: usize,
    },
    ZeroWeight {
        city: usize,
        neighbor: usize,
    },
    SelfLoop {
        city: usize,
    },
    DuplicateEdge {
        city: usize,
        neighbor: usize,
    },
    AsymmetricEdge {
        city: usize,
        neighbor: usize,
    },
    MismatchedEdgeWeight {
        city: usize,
        neighbor: usize,
        forward: u32,
        reverse: u32,
    },
}

/// Checks every consumer needs: right node count and in-range neighbours.
/// Zero and large weights are legal for Dijkstra, so they are left to the
/// resistive validator, which is the only caller that needs positivity.
pub fn validate_graph(graph: &Graph) -> Result<(), GraphError> {
    if graph.len() != CITY_COUNT {
        return Err(GraphError::InvalidGraphSize {
            expected: CITY_COUNT,
            actual: graph.len(),
        });
    }
    for (city, roads) in graph.iter().enumerate() {
        for &(neighbor, _) in roads {
            if neighbor >= CITY_COUNT {
                return Err(GraphError::InvalidNeighbor { city, neighbor });
            }
        }
    }
    Ok(())
}

/// The supported input contract for effective resistance: a simple undirected
/// graph with strictly positive, reciprocal, equal-weight roads. This is a
/// contract check, not a claim that parallel roads are mathematically
/// undefined -- two parallel resistors would just add their conductances and a
/// self-loop cancels out of the Laplacian. The engine does not model either, so
/// it rejects them instead of silently folding them in and reporting a
/// resistance that does not match the visible road list.
pub fn validate_resistive_graph(graph: &Graph) -> Result<(), GraphError> {
    validate_graph(graph)?;
    for (city, roads) in graph.iter().enumerate() {
        for (index, &(neighbor, weight)) in roads.iter().enumerate() {
            if neighbor == city {
                return Err(GraphError::SelfLoop { city });
            }
            if weight == 0 {
                return Err(GraphError::ZeroWeight { city, neighbor });
            }
            if roads[..index].iter().any(|(other, _)| *other == neighbor) {
                return Err(GraphError::DuplicateEdge { city, neighbor });
            }
            match graph[neighbor].iter().find(|(to, _)| *to == city) {
                None => return Err(GraphError::AsymmetricEdge { city, neighbor }),
                Some(&(_, reverse_weight)) if reverse_weight != weight => {
                    return Err(GraphError::MismatchedEdgeWeight {
                        city,
                        neighbor,
                        forward: weight,
                        reverse: reverse_weight,
                    });
                }
                Some(_) => {}
            }
        }
    }
    Ok(())
}

pub fn make_graph() -> Graph {
    let roads: [(usize, usize, u32); 23] = [
        (0, 1, 75),
        (1, 2, 71),
        (2, 3, 151),
        (0, 3, 140),
        (0, 4, 118),
        (4, 5, 111),
        (5, 6, 70),
        (6, 7, 75),
        (7, 8, 120),
        (8, 9, 146),
        (8, 10, 138),
        (3, 9, 80),
        (3, 11, 99),
        (9, 10, 97),
        (11, 12, 211),
        (10, 12, 101),
        (12, 13, 90),
        (12, 14, 85),
        (14, 15, 98),
        (15, 16, 86),
        (14, 17, 142),
        (17, 18, 92),
        (18, 19, 87),
    ];
    let mut graph = vec![Vec::new(); CITY_COUNT];
    for (a, b, distance) in roads {
        graph[a].push((b, distance));
        graph[b].push((a, distance));
    }
    graph
}
