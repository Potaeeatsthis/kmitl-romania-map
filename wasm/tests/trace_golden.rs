//! The animation trace, pinned to committed records.
//!
//! The other tests check the trace's *shape*: that it has one frame per expansion and
//! that the expanded cities match explored_order. Its contents were only ever asserted
//! for UCS step 0 and the goal frame of one route, so a change to how make_step() sorts
//! or dedupes the frontier could shift every middle frame while cargo test stayed green
//! (scripts/verify_mutation.sh, M10). Every frame of the animation renders from this
//! data, so it gets the same fixed-point treatment tests/golden/ gives the CLI output.
//!
//! Re-record after an intended change, then read the diff before committing:
//!     UPDATE_GOLDEN=1 cargo test --manifest-path wasm/Cargo.toml
//!
//! Formatted here rather than with serde: CLAUDE.md keeps the crate dependency-free
//! outside the browser boundary, and a test has no business widening that.

use std::fmt::Write as _;
use std::fs;
use std::path::PathBuf;

use romania_search::graph::{make_graph, CITIES, CITY_COUNT};
use romania_search::heuristics::current_flow_for_goal;
use romania_search::metrics::SearchResult;
use romania_search::search::search;

/// The documented example, plus a long cross-map traversal so the middle frames of a
/// deep search are covered rather than just the first and last.
const ROUTES: [(&str, usize, usize); 2] = [("arad-bucharest", 0, 12), ("drobeta-neamt", 7, 19)];

fn golden_path(slug: &str, algorithm: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests/golden")
        .join(format!("{slug}-{algorithm}.txt"))
}

fn render(result: &SearchResult) -> String {
    let mut out = String::new();
    let route: Vec<_> = result.path.iter().map(|&city| CITIES[city]).collect();
    writeln!(out, "path {}", route.join(" -> ")).expect("writing to a String cannot fail");
    writeln!(out, "cost {}", result.cost).expect("writing to a String cannot fail");
    writeln!(
        out,
        "expanded {} generated {} peak_frontier {}",
        result.expanded, result.generated, result.peak_frontier
    )
    .expect("writing to a String cannot fail");

    for (index, step) in result.trace.iter().enumerate() {
        let frontier: Vec<_> = step
            .frontier
            .iter()
            // Six decimals: the heuristic comes from the embedded table, so the bits are
            // identical everywhere, but rounding keeps the record free of any platform
            // difference in how the last digits of an f64 are printed.
            .map(|node| format!("{}:{}:{:.6}", node.city, node.cost, node.priority))
            .collect();
        let discovered: Vec<_> = step
            .discovered
            .iter()
            .map(|node| match node.parent {
                Some(parent) => format!("{}:{}:{}", node.city, node.cost, parent),
                None => format!("{}:{}:-", node.city, node.cost),
            })
            .collect();
        writeln!(
            out,
            "{index:02} expanded={} cost={} | frontier {} | discovered {}",
            step.expanded,
            step.expanded_cost,
            frontier.join(","),
            discovered.join(",")
        )
        .expect("writing to a String cannot fail");
    }
    out
}

fn compare(slug: &str, algorithm: &str, rendered: &str) {
    let path = golden_path(slug, algorithm);

    if std::env::var_os("UPDATE_GOLDEN").is_some() {
        fs::create_dir_all(path.parent().expect("golden path has a parent"))
            .expect("failed to create the golden directory");
        fs::write(&path, rendered).expect("failed to write the golden file");
        return;
    }

    let expected = fs::read_to_string(&path).unwrap_or_else(|_| {
        panic!(
            "{} is missing -- re-record with: UPDATE_GOLDEN=1 cargo test --manifest-path wasm/Cargo.toml",
            path.display()
        )
    });

    // Line by line, so a failure names the frame that moved instead of printing two
    // twenty-line blobs and leaving the reader to find the difference.
    for (line, (want, got)) in expected.lines().zip(rendered.lines()).enumerate() {
        assert_eq!(
            want,
            got,
            "{slug} ({algorithm}) differs at line {}",
            line + 1
        );
    }
    assert_eq!(
        expected.lines().count(),
        rendered.lines().count(),
        "{slug} ({algorithm}) has a different number of frames"
    );
}

#[test]
fn ucs_trace_matches_the_committed_golden() {
    let graph = make_graph();
    let zeroes = vec![0.0; CITY_COUNT];
    for (slug, start, goal) in ROUTES {
        let result = search(&graph, start, goal, &zeroes).expect("the road graph is connected");
        compare(slug, "ucs", &render(&result));
    }
}

#[test]
fn astar_trace_matches_the_committed_golden() {
    let graph = make_graph();
    for (slug, start, goal) in ROUTES {
        let heuristic = current_flow_for_goal(goal).expect("goal is a valid city");
        let result = search(&graph, start, goal, heuristic).expect("the road graph is connected");
        compare(slug, "astar", &render(&result));
    }
}
