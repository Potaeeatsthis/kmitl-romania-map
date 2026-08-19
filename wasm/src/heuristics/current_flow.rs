use crate::graph::{Graph, CITY_COUNT};

/// I4: engine code never panics. A disconnected graph is a value, not a crash.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeuristicError {
    DisconnectedGraph,
}

pub struct HeuristicResult {
    pub values: Vec<f64>,
    pub logical_workspace_bytes: usize,
}

pub fn current_flow_heuristic(
    graph: &Graph,
    goal: usize,
) -> Result<HeuristicResult, HeuristicError> {
    let mut laplacian = vec![vec![0.0; CITY_COUNT]; CITY_COUNT];
    for a in 0..CITY_COUNT {
        for &(b, distance) in &graph[a] {
            let conductance = 1.0 / distance as f64;
            laplacian[a][a] += conductance;
            laplacian[a][b] -= conductance;
        }
    }

    let kept: Vec<usize> = (0..CITY_COUNT).filter(|&city| city != goal).collect();
    let n = CITY_COUNT - 1;
    let mut augmented = vec![vec![0.0; 2 * n]; n];
    for i in 0..n {
        for j in 0..n {
            augmented[i][j] = laplacian[kept[i]][kept[j]];
        }
        augmented[i][n + i] = 1.0;
    }

    for column in 0..n {
        let mut pivot = column;
        for row in (column + 1)..n {
            if augmented[row][column].abs() > augmented[pivot][column].abs() {
                pivot = row;
            }
        }
        if augmented[pivot][column].abs() < 1e-14 {
            return Err(HeuristicError::DisconnectedGraph);
        }
        augmented.swap(column, pivot);
        let divisor = augmented[column][column];
        for value in &mut augmented[column] {
            *value /= divisor;
        }
        for row in 0..n {
            if row == column { continue; }
            let factor = augmented[row][column];
            if factor == 0.0 { continue; }
            for j in 0..(2 * n) {
                augmented[row][j] -= factor * augmented[column][j];
            }
        }
    }

    let mut values = vec![0.0; CITY_COUNT];
    for i in 0..n {
        // Diagonal of the inverse grounded Laplacian is R_eff(city, goal).
        values[kept[i]] = augmented[i][n + i].max(0.0);
    }
    let workspace = CITY_COUNT * CITY_COUNT * 8 + n * (2 * n) * 8 + CITY_COUNT * 8;
    Ok(HeuristicResult { values, logical_workspace_bytes: workspace })
}
