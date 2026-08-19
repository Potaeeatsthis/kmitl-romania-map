pub const CITY_COUNT: usize = 20;

pub const CITIES: [&str; CITY_COUNT] = [
    "Arad", "Zerind", "Oradea", "Sibiu", "Timisoara", "Lugoj",
    "Mehadia", "Drobeta", "Craiova", "Rimnicu Vilcea", "Pitesti",
    "Fagaras", "Bucharest", "Giurgiu", "Urziceni", "Hirsova",
    "Eforie", "Vaslui", "Iasi", "Neamt",
];

pub type Graph = Vec<Vec<(usize, u32)>>;

pub fn make_graph() -> Graph {
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
