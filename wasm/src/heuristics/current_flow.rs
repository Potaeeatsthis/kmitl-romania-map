use crate::graph::{Graph, CITY_COUNT};

include!(concat!(env!("OUT_DIR"), "/current_flow_table.rs"));

/// I4: engine code never panics. A disconnected graph is a value, not a crash.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HeuristicError {
    InvalidGoal(usize),
    WrongGraphSize { expected: usize, actual: usize },
    InvalidRoad { city: usize, neighbor: usize },
    ZeroDistance { city: usize, neighbor: usize },
    DisconnectedGraph,
}

pub struct HeuristicResult {
    pub values: Vec<f64>,
    pub logical_workspace_bytes: usize,
}

pub fn current_flow_for_goal(goal: usize) -> Result<&'static [f64], HeuristicError> {
    if goal >= CITY_COUNT {
        return Err(HeuristicError::InvalidGoal(goal));
    }
    Ok(&CURRENT_FLOW_HEURISTICS[goal])
}

pub fn current_flow_heuristic(
    graph: &Graph,
    goal: usize,
) -> Result<HeuristicResult, HeuristicError> {
    if goal >= CITY_COUNT {
        return Err(HeuristicError::InvalidGoal(goal));
    }
    if graph.len() != CITY_COUNT {
        return Err(HeuristicError::WrongGraphSize {
            expected: CITY_COUNT,
            actual: graph.len(),
        });
    }

    let mut laplacian = vec![vec![0.0; CITY_COUNT]; CITY_COUNT];
    for (a, roads) in graph.iter().enumerate() {
        for &(b, distance) in roads {
            if b >= CITY_COUNT {
                return Err(HeuristicError::InvalidRoad {
                    city: a,
                    neighbor: b,
                });
            }
            if distance == 0 {
                return Err(HeuristicError::ZeroDistance {
                    city: a,
                    neighbor: b,
                });
            }
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
            if row == column {
                continue;
            }
            let factor = augmented[row][column];
            if factor == 0.0 {
                continue;
            }
            let (target_row, pivot_row) = if row < column {
                let (before, from_pivot) = augmented.split_at_mut(column);
                (&mut before[row], &from_pivot[0])
            } else {
                let (before, from_row) = augmented.split_at_mut(row);
                (&mut from_row[0], &before[column])
            };
            for (target, pivot) in target_row.iter_mut().zip(pivot_row.iter()) {
                *target -= factor * pivot;
            }
        }
    }

    let mut values = vec![0.0; CITY_COUNT];
    for i in 0..n {
        // Diagonal of the inverse grounded Laplacian is R_eff(city, goal).
        values[kept[i]] = augmented[i][n + i].max(0.0);
    }
    let workspace = CITY_COUNT * CITY_COUNT * 8 + n * (2 * n) * 8 + CITY_COUNT * 8;
    Ok(HeuristicResult {
        values,
        logical_workspace_bytes: workspace,
    })
}
