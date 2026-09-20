# UCS and Custom A* with a Current-Flow Heuristic

## 1. Project Overview

This project compares two search algorithms on the Romania road map:

1. **Uniform-Cost Search (UCS)**
2. **Custom A* Search with a Current-Flow Heuristic**

Both algorithms try to find the lowest-cost route from a start city to a destination city. The road distance between two connected cities is used as the edge cost.

The main difference is that UCS only uses the cost already travelled, while A* also estimates the remaining cost to the destination.

---

## 2. Graph Representation

The Romania road map is represented as a weighted graph:

- A **city** is a node.
- A **road** is an edge.
- A **road distance** is the edge weight.
- The start city is written as \(s\).
- The destination city is written as \(t\).

For example:

```text
Arad --75--> Zerind
Arad --118-> Timisoara
Arad --140-> Sibiu
```

The objective is to find a path with the minimum total road cost.

---

# Part A: Uniform-Cost Search

## 3. What Is UCS?

Uniform-Cost Search is a blind or uninformed search algorithm. It does not know which city is closer to the destination.

UCS always expands the frontier node with the lowest accumulated cost:

\[
g(n)
\]

where:

- \(n\) is the current node.
- \(g(n)\) is the total cost from the start city to node \(n\).

UCS uses:

\[
f(n)=g(n)
\]

It does not use a heuristic, so we can also write:

\[
h(n)=0
\]

---

## 4. How UCS Works

1. Add the start city to a priority queue.
2. Give the start city a cost of zero.
3. Remove the city with the smallest \(g(n)\).
4. If it is the destination, return the path.
5. Otherwise, check all connected cities.
6. Update a connected city when a cheaper path is found.
7. Repeat until the destination is reached or the queue is empty.

### UCS Pseudocode

```text
function UCS(start, goal):
    frontier = priority queue ordered by g
    frontier.push(start, priority = 0)

    bestCost[start] = 0
    parent[start] = null

    while frontier is not empty:
        current = frontier.popLowestPriority()

        if current == goal:
            return reconstructPath(parent, goal)

        for each neighbor of current:
            newCost = bestCost[current] + roadCost(current, neighbor)

            if neighbor is not recorded
               or newCost < bestCost[neighbor]:

                bestCost[neighbor] = newCost
                parent[neighbor] = current
                frontier.push(neighbor, priority = newCost)

    return no path
```

---

## 5. UCS Properties

### Advantages

- It finds the optimal path when all road costs are non-negative.
- It is simple to understand and implement.
- It is a good baseline for comparing another search algorithm.
- It does not need city coordinates or extra information.

### Limitations

- It does not know the direction of the destination.
- It may expand many cities that are not useful.
- It can use more time and memory on a large graph.

---

# Part B: Custom A* Search

## 6. What Is A*?

A* is an informed search algorithm. It uses both the travelled cost and an estimate of the remaining cost.

A* selects the node with the lowest:

\[
f(n)=g(n)+h(n)
\]

where:

- \(g(n)\) is the real cost from the start to node \(n\).
- \(h(n)\) is the estimated cost from node \(n\) to the destination.
- \(f(n)\) is the estimated total route cost.

The standard A* algorithm is not changed. The custom part of this project is the heuristic function.

---

# Part C: Current-Flow Heuristic

## 7. Main Idea

The Current-Flow Heuristic treats the road network like an electrical circuit.

The comparison is:

| Road Network | Electrical Network |
|---|---|
| City | Electrical node |
| Road | Resistor |
| Road cost or distance | Electrical resistance |
| Many possible routes | Parallel current paths |
| Destination estimate | Effective resistance |

For each road \(e\), its resistance is:

\[
R_e=w_e
\]

where \(w_e\) is the road cost.

A short road has lower resistance. A long road has higher resistance.

The electrical current can travel through several possible routes. Therefore, the heuristic uses information about the whole road network, not only a straight line between two cities.

---

## 8. Conductance

It is easier to build the graph matrix by using conductance.

Conductance is the inverse of resistance:

\[
c_{ij}=\frac{1}{w_{ij}}
\]

where:

- \(w_{ij}\) is the road cost between cities \(i\) and \(j\).
- \(c_{ij}\) is the conductance of that road.

A road with a small cost has high conductance. A road with a large cost has low conductance.

---

## 9. Weighted Kirchhoff Matrix

The Current-Flow Heuristic uses a weighted Kirchhoff matrix \(L\), also known as the weighted graph Laplacian.

For the diagonal values:

\[
L_{ii}=\sum_j c_{ij}
\]

For connected cities \(i\) and \(j\):

\[
L_{ij}=-c_{ij}
\]

For cities that are not directly connected:

\[
L_{ij}=0
\]

The matrix describes the connections and conductances of the complete road network.

---

## 10. Effective Resistance

To estimate the remaining cost from the current city \(n\) to destination \(t\):

1. Inject one unit of electrical current at city \(n\).
2. Remove one unit of current at city \(t\).
3. Allow the current to move through every available route.
4. Calculate the effective resistance between \(n\) and \(t\).

Using the pseudoinverse of the Kirchhoff matrix, the effective resistance is:

\[
R_{\text{eff}}(n,t)
=
L^+_{nn}
+
L^+_{tt}
-
2L^+_{nt}
\]

where \(L^+\) is the Moore-Penrose pseudoinverse of \(L\).

The heuristic is:

\[
h_{\text{CF}}(n,t)=R_{\text{eff}}(n,t)
\]

Therefore, Custom A* uses:

\[
f(n)=g(n)+h_{\text{CF}}(n,t)
\]

---

## 11. Simple Example

Consider this small road network:

```text
        4          4
A ------------- B ----- D
 \                       /
  \ 6                 6 /
   ----------- C -------
```

There are two main routes from \(A\) to \(D\):

```text
A -> B -> D = 4 + 4 = 8
A -> C -> D = 6 + 6 = 12
```

The shortest route has a cost of:

\[
8
\]

In the electrical model, the two complete routes act like parallel resistances:

\[
R_1=8
\]

\[
R_2=12
\]

The effective resistance is:

\[
R_{\text{eff}}
=
\frac{R_1R_2}{R_1+R_2}
=
\frac{8 \times 12}{8+12}
=
4.8
\]

Therefore:

\[
h_{\text{CF}}(A,D)=4.8
\]

The heuristic value is smaller than the real shortest-path cost:

\[
4.8 \leq 8
\]

The current-flow value is low because the electrical current can use both routes. A vehicle cannot divide itself between the routes, but electrical current can.

This is why effective resistance normally gives a lower-bound estimate of the remaining shortest-path cost.

---

## 12. Why the Heuristic Is Admissible

A heuristic is admissible when it never estimates a cost higher than the true shortest-path cost:

\[
h(n)\leq h^*(n)
\]

where \(h^*(n)\) is the true minimum remaining cost.

When every road resistance is equal to its non-negative road cost, the effective resistance is not greater than the resistance of any single route.

The shortest route is one possible electrical route. Extra routes give the current more choices and can only reduce or keep the same effective resistance.

Therefore:

\[
R_{\text{eff}}(n,t)
\leq
\text{shortestPathCost}(n,t)
\]

So:

\[
h_{\text{CF}}(n,t)
\leq
h^*(n)
\]

Under these conditions, the Current-Flow Heuristic is admissible, and A* can still return an optimal path.

### Important Conditions

The admissibility argument assumes that:

- Every road cost is non-negative.
- Each road resistance is set equal to its search cost.
- The same fixed graph is used for both search and heuristic calculation.
- The heuristic is not multiplied by a value greater than one.

---

## 13. Consistency

A heuristic is consistent when:

\[
h(n)
\leq
w(n,n')+h(n')
\]

for every road from \(n\) to \(n'\).

Effective resistance behaves as a distance metric and follows a triangle inequality. Also, the effective resistance between two directly connected cities cannot be greater than the resistance of their direct road.

Therefore, with road resistance equal to road cost, the Current-Flow Heuristic can be treated as consistent.

Consistency is useful because A* normally does not need to reopen a node after its best cost has been confirmed.

---

## 14. Custom A* Pseudocode

```text
function CurrentFlowAStar(start, goal):
    frontier = priority queue ordered by f
    g[start] = 0

    hStart = effectiveResistance(start, goal)
    frontier.push(start, priority = g[start] + hStart)

    parent[start] = null

    while frontier is not empty:
        current = frontier.popLowestPriority()

        if current == goal:
            return reconstructPath(parent, goal)

        for each neighbor of current:
            tentativeG = g[current] + roadCost(current, neighbor)

            if neighbor is not recorded
               or tentativeG < g[neighbor]:

                g[neighbor] = tentativeG
                h = effectiveResistance(neighbor, goal)
                f = g[neighbor] + h

                parent[neighbor] = current
                frontier.push(neighbor, priority = f)

    return no path
```

---

## 15. Precomputation

Calculating the matrix pseudoinverse during every search step would be inefficient.

A better process is:

1. Build the Kirchhoff matrix once.
2. Calculate the pseudoinverse \(L^+\) once.
3. Store the result.
4. Use matrix values to calculate each heuristic with a fast lookup.

After \(L^+\) is available:

\[
h_{\text{CF}}(n,t)
=
L^+_{nn}
+
L^+_{tt}
-
2L^+_{nt}
\]

Each heuristic lookup only needs a few matrix values.

For a small Romania map, the complete heuristic table can also be calculated before the animation starts and stored as JSON.

Example:

```json
{
  "Arad": {
    "Bucharest": 210.45,
    "Craiova": 154.21
  },
  "Sibiu": {
    "Bucharest": 126.73,
    "Craiova": 98.64
  }
}
```

The numbers above are only examples, not official Romania-map results.

---

## 16. Why This Heuristic Is Creative

Many A* projects use straight-line distance or a landmark heuristic.

The Current-Flow Heuristic is different because it studies the structure of the whole road graph.

It can recognize:

- Multiple possible routes
- Strongly connected areas
- Narrow road sections
- Alternative paths
- The general accessibility of the destination

For example, two cities may look close on a map, but only one long road may connect them. Current flow can show that the connection is weak.

Another pair may have several useful routes. Current flow can show that the connection is strong.

---

## 17. Possible Weakness

Effective resistance may be much smaller than the real shortest-path cost when many parallel routes exist.

For example:

```text
Real remaining shortest-path cost = 200
Current-flow estimate = 60
```

This estimate is safe because it does not overestimate, but it may not guide A* strongly.

A heuristic that is too small makes A* behave more like UCS.

Therefore, the Current-Flow Heuristic is mathematically interesting, but it may not always expand the fewest nodes.

This should be tested experimentally instead of assuming that it will always be faster.

---

# Part D: Comparison

## 18. UCS and Custom A* Comparison

| Feature | UCS | Custom A* with Current Flow |
|---|---|---|
| Evaluation function | \(f(n)=g(n)\) | \(f(n)=g(n)+h_{\text{CF}}(n,t)\) |
| Uses a heuristic | No | Yes |
| Uses map coordinates | No | No |
| Uses complete graph structure | No | Yes |
| Optimal with valid conditions | Yes | Yes |
| Precomputation needed | No | Yes |
| Expected expanded nodes | Usually more | Possibly fewer |
| Implementation difficulty | Lower | Higher |
| Main purpose | Baseline | Informed custom method |

---

## 19. Fair Experiment Design

Both algorithms should use:

- The same Romania graph
- The same road costs
- The same start city
- The same destination city
- The same priority queue design
- The same path reconstruction method
- The same computer and browser
- The same measurement process

Only the search priority should be different.

UCS:

\[
\text{priority}=g(n)
\]

Custom A*:

\[
\text{priority}=g(n)+h_{\text{CF}}(n,t)
\]

---

## 20. Metrics to Measure

### 20.1 Final Path Cost

The total cost of the returned path:

\[
\text{Path Cost}
=
\sum_{e \in \text{path}}w_e
\]

Both algorithms should return the same optimal path cost.

### 20.2 Number of Expanded Nodes

Count every node removed from the priority queue and processed.

A lower number means the search explored less of the graph.

### 20.3 Maximum Frontier Size

Record the largest number of nodes stored in the priority queue at one time.

This gives information about memory usage.

### 20.4 Runtime

Measure the search time:

```text
end time - start time
```

The heuristic precomputation time should be reported separately from the search time.

Suggested values:

```text
Precomputation time
Average search time
Total time including precomputation
```

### 20.5 Memory Usage

Measure or estimate:

- Priority queue size
- Visited-node storage
- Parent map
- Cost map
- Kirchhoff-matrix pseudoinverse storage

### 20.6 Heuristic Accuracy

For every expanded node, compare:

\[
h_{\text{CF}}(n,t)
\]

with the true remaining shortest-path cost:

\[
h^*(n,t)
\]

A useful ratio is:

\[
\text{Heuristic Ratio}
=
\frac{h_{\text{CF}}(n,t)}{h^*(n,t)}
\]

A value near \(1\) means the heuristic is informative.

A value near \(0\) means the heuristic is weak.

---

## 21. Suggested Test Routes

Use several route types:

1. A short route
2. A medium route
3. A long route
4. A route through a highly connected area
5. A route through a narrow or weakly connected area

For example, the project may test routes such as:

```text
Arad -> Bucharest
Oradea -> Bucharest
Timisoara -> Neamt
Craiova -> Iasi
Lugoj -> Giurgiu
```

The exact routes should match the final graph data.

Run each route several times and calculate the average runtime because one browser measurement can contain noise.

---

## 22. Expected Results

The expected result is:

- UCS and Custom A* should find the same optimal path cost.
- UCS may expand more nodes because it has no destination estimate.
- Custom A* may expand fewer nodes because it uses current-flow information.
- Current-flow precomputation adds an extra initial cost.
- On a small graph, runtime differences may be very small.
- The most important comparison may be the number of expanded nodes and the maximum frontier size.

The actual result may be different. The final report should use measured data rather than only expected behaviour.

---

## 23. Result Table

Measured, not illustrative. Produced by `cargo run --bin cli` and pinned by
`wasm/tests/golden/`.

| Route | Algorithm | Path Cost | Expanded Nodes | Generated | Max Frontier |
|---|---:|---:|---:|---:|---:|
| Arad to Bucharest | UCS | 418 | 13 | 14 | 4 |
| Arad to Bucharest | Current-Flow A* | 418 | 9 | 13 | 6 |

Across all 400 start/goal pairs: UCS expands 4200 nodes, current-flow A* expands 2436 —
a 42.0% reduction, with zero cost mismatches against an independent Dijkstra.

Two things in this table are worth noticing.

**A\* holds a *larger* peak frontier than UCS** — 6 against 4 — while expanding fewer
nodes. The heuristic makes A\* reach further ahead before committing, so more cities are
in the queue at once even though fewer are ever removed from it. Expanding less does not
mean storing less.

**Search time is deliberately absent.** It is machine-dependent and, in compiled code,
too small to measure honestly: the search runs in microseconds, and repeated runs on the
same machine vary by about 2×. Expansion counts are exact integers, identical on every
machine, which is why they are the comparison this project reports. See invariant I5 in
`CLAUDE.md`.

---

## 24. Suggested Hypothesis

> Custom A* with the Current-Flow Heuristic will find the same optimal path as Uniform-Cost Search, but it may expand fewer nodes because it uses information about the complete road network. However, the heuristic requires matrix precomputation, and its estimate may become weak when the graph contains many parallel routes.

---

## 25. Conclusion

Uniform-Cost Search is a strong baseline because it is optimal and does not need a heuristic. However, it explores the graph without knowing the destination direction.

Custom A* improves the search priority by adding a Current-Flow Heuristic. This heuristic changes the road graph into an electrical network and uses effective resistance as an estimate of the remaining route cost.

The method is creative because it uses the complete network structure instead of only geographical distance. When road resistance is equal to road cost, effective resistance is a lower bound on shortest-path cost. Therefore, the heuristic is admissible under the stated conditions.

The experiment should compare path cost, expanded nodes, frontier size, runtime, memory, and heuristic accuracy. The final conclusion should be based on measured results from the implemented Romania road-map application.

---

# Appendix A: Main Formulas

### UCS

\[
f(n)=g(n)
\]

### A*

\[
f(n)=g(n)+h(n)
\]

### Road Conductance

\[
c_{ij}=\frac{1}{w_{ij}}
\]

### Weighted Kirchhoff Matrix

\[
L_{ii}=\sum_j c_{ij}
\]

\[
L_{ij}=-c_{ij}
\]

### Current-Flow Heuristic

\[
h_{\text{CF}}(n,t)
=
L^+_{nn}
+
L^+_{tt}
-
2L^+_{nt}
\]

### Admissibility

\[
h_{\text{CF}}(n,t)
\leq
h^*(n,t)
\]

### Custom A* Priority

\[
f(n)
=
g(n)
+
h_{\text{CF}}(n,t)
\]

---

# Appendix B: Short Presentation Explanation

> UCS chooses the city with the lowest travelled cost. It does not estimate the distance to the destination. Our Custom A* uses the same travelled cost, but it adds a Current-Flow Heuristic. We treat roads as electrical resistors and calculate the effective resistance from the current city to the destination. This value uses the structure of the complete road network. It is a lower-bound estimate when road resistance is equal to road cost, so A* can still find the optimal path. We compare both algorithms by path cost, expanded nodes, frontier size, runtime, and memory.
