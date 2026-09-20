use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;

const CITY_COUNT: usize = 20;
const CITIES: [&str; CITY_COUNT] = [
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

fn main() {
    println!("cargo:rerun-if-changed=data/heuristics.json");

    let source =
        fs::read_to_string("data/heuristics.json").expect("failed to read data/heuristics.json");
    validate_city_order(&source);
    let values = parse_values(&source);

    let mut generated =
        String::from("pub(crate) const CURRENT_FLOW_HEURISTICS: [[f64; 20]; 20] = [\n");
    for row in values.chunks_exact(CITY_COUNT) {
        generated.push_str("    [");
        for (index, value) in row.iter().enumerate() {
            if index > 0 {
                generated.push_str(", ");
            }
            write!(generated, "{value:?}").expect("writing to String cannot fail");
        }
        generated.push_str("],\n");
    }
    generated.push_str("];\n");

    let output = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR is set by Cargo"))
        .join("current_flow_table.rs");
    fs::write(output, generated).expect("failed to write generated heuristic table");
}

fn validate_city_order(source: &str) {
    let cities_key = source
        .find("\"cities\"")
        .expect("heuristics.json needs cities");

    let city_section = &source[cities_key..];
    let start = city_section.find('[').expect("cities must be an array");
    let after_start = &city_section[start + 1..];
    let end = after_start.find(']').expect("cities array must close");

    let actual: Vec<_> = after_start[..end].split('"').skip(1).step_by(2).collect();

    assert_eq!(actual, CITIES, "heuristic city order must match the graph");
}

fn parse_values(source: &str) -> Vec<f64> {
    let values_key = source
        .find("\"values_by_goal\"")
        .expect("heuristics.json needs values_by_goal");
    let values_section = &source[values_key..];
    let start = values_section
        .find('[')
        .expect("values_by_goal must be an array");
    let values_section = &values_section[start..];

    let values: Vec<f64> = values_section
        .split(|character: char| {
            !character.is_ascii_digit()
                && character != '.'
                && character != '-'
                && character != '+'
                && character != 'e'
                && character != 'E'
        })
        .filter(|token| !token.is_empty())
        .map(|token| {
            token
                .parse::<f64>()
                .expect("heuristic values must be numbers")
        })
        .collect();

    assert_eq!(
        values.len(),
        CITY_COUNT * CITY_COUNT,
        "heuristic table must be 20 by 20"
    );
    assert!(
        values
            .iter()
            .all(|value| value.is_finite() && *value >= 0.0),
        "heuristic values must be finite and non-negative"
    );
    for goal in 0..CITY_COUNT {
        assert!(
            values[goal * CITY_COUNT + goal].abs() <= 1e-9,
            "each goal must have a zero heuristic to itself"
        );
    }

    values
}
