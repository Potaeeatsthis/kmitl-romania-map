#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <limits>
#include <queue>
#include <stdexcept>
#include <string>
#include <tuple>
#include <utility>
#include <vector>

using Clock = std::chrono::steady_clock;

constexpr int CITY_COUNT = 20;
constexpr int BENCHMARK_RUNS = 5000;
constexpr double INF = std::numeric_limits<double>::infinity();

const std::vector<std::string> CITIES = {
    "Arad", "Zerind", "Oradea", "Sibiu", "Timisoara", "Lugoj",
    "Mehadia", "Drobeta", "Craiova", "Rimnicu Vilcea", "Pitesti",
    "Fagaras", "Bucharest", "Giurgiu", "Urziceni", "Hirsova",
    "Eforie", "Vaslui", "Iasi", "Neamt",
};

using Edge = std::pair<int, int>;  // neighbor, distance
using Graph = std::vector<std::vector<Edge>>;

Graph make_graph() {
    Graph graph(CITY_COUNT);
    const std::vector<std::tuple<int, int, int>> roads = {
        {0, 1, 75}, {1, 2, 71}, {2, 3, 151}, {0, 3, 140},
        {0, 4, 118}, {4, 5, 111}, {5, 6, 70}, {6, 7, 75},
        {7, 8, 120}, {8, 9, 146}, {8, 10, 138}, {3, 9, 80},
        {3, 11, 99}, {9, 10, 97}, {11, 12, 211}, {10, 12, 101},
        {12, 13, 90}, {12, 14, 85}, {14, 15, 98}, {15, 16, 86},
        {14, 17, 142}, {17, 18, 92}, {18, 19, 87},
    };
    for (const auto& [a, b, distance] : roads) {
        graph[a].push_back({b, distance});
        graph[b].push_back({a, distance});
    }
    return graph;
}

const Graph GRAPH = make_graph();

struct SearchResult {
    std::vector<int> path;
    std::vector<int> explored_order;
    int cost{};
    int expanded{};
    int generated{};
    std::size_t peak_frontier{};
    std::size_t peak_records{};
    std::size_t peak_payload_bytes{};
};

struct QueueEntry {
    double f;
    int g;
    int city;
};

struct LowestFirst {
    bool operator()(const QueueEntry& a, const QueueEntry& b) const {
        if (a.f != b.f) return a.f > b.f;
        if (a.g != b.g) return a.g > b.g;
        return a.city > b.city;
    }
};

SearchResult search(int start, int goal, const std::vector<double>& heuristic) {
    std::vector<int> best(CITY_COUNT, std::numeric_limits<int>::max());
    std::vector<int> parent(CITY_COUNT, -1);
    std::vector<bool> settled(CITY_COUNT, false);
    std::priority_queue<QueueEntry, std::vector<QueueEntry>, LowestFirst> frontier;
    best[start] = 0;
    frontier.push({heuristic[start], 0, start});

    int expanded = 0;
    int generated = 1;
    std::size_t discovered = 1;
    std::size_t peak_frontier = 1;
    std::size_t peak_records = 2;
    std::size_t peak_payload = 32;
    std::vector<int> explored_order;

    auto update_peaks = [&]() {
        const std::size_t frontier_count = frontier.size();
        const std::size_t settled_count = static_cast<std::size_t>(expanded);
        peak_frontier = std::max(peak_frontier, frontier_count);
        peak_records = std::max(peak_records, frontier_count + discovered + settled_count * 2);
        peak_payload = std::max(
            peak_payload,
            frontier_count * 20 + discovered * 12 + settled_count * 5
        );
    };

    while (!frontier.empty()) {
        const QueueEntry entry = frontier.top();
        frontier.pop();
        const int current = entry.city;
        if (entry.g != best[current] || settled[current]) continue;
        settled[current] = true;
        ++expanded;
        explored_order.push_back(current);
        update_peaks();

        if (current == goal) {
            std::vector<int> path;
            for (int node = goal; node != -1; node = parent[node]) path.push_back(node);
            std::reverse(path.begin(), path.end());
            return {path, explored_order, entry.g, expanded, generated, peak_frontier, peak_records, peak_payload};
        }

        for (const auto& [neighbor, road_cost] : GRAPH[current]) {
            if (settled[neighbor]) continue;
            const int new_cost = entry.g + road_cost;
            if (new_cost < best[neighbor]) {
                if (best[neighbor] == std::numeric_limits<int>::max()) ++discovered;
                best[neighbor] = new_cost;
                parent[neighbor] = current;
                frontier.push({new_cost + heuristic[neighbor], new_cost, neighbor});
                ++generated;
                update_peaks();
            }
        }
    }
    throw std::runtime_error("No route exists between the selected cities");
}

struct HeuristicResult {
    std::vector<double> values;
    std::size_t logical_workspace_bytes;
};

HeuristicResult current_flow_heuristic(int goal) {
    std::vector<std::vector<double>> laplacian(
        CITY_COUNT, std::vector<double>(CITY_COUNT, 0.0)
    );
    for (int a = 0; a < CITY_COUNT; ++a) {
        for (const auto& [b, distance] : GRAPH[a]) {
            const double conductance = 1.0 / distance;
            laplacian[a][a] += conductance;
            laplacian[a][b] -= conductance;
        }
    }

    std::vector<int> kept;
    for (int city = 0; city < CITY_COUNT; ++city) {
        if (city != goal) kept.push_back(city);
    }
    const int n = CITY_COUNT - 1;
    std::vector<std::vector<double>> augmented(n, std::vector<double>(2 * n, 0.0));
    for (int i = 0; i < n; ++i) {
        for (int j = 0; j < n; ++j) augmented[i][j] = laplacian[kept[i]][kept[j]];
        augmented[i][n + i] = 1.0;
    }

    for (int column = 0; column < n; ++column) {
        int pivot = column;
        for (int row = column + 1; row < n; ++row) {
            if (std::abs(augmented[row][column]) > std::abs(augmented[pivot][column])) {
                pivot = row;
            }
        }
        if (std::abs(augmented[pivot][column]) < 1e-14) {
            throw std::runtime_error("The road graph must be connected");
        }
        std::swap(augmented[column], augmented[pivot]);
        const double divisor = augmented[column][column];
        for (double& value : augmented[column]) value /= divisor;
        for (int row = 0; row < n; ++row) {
            if (row == column) continue;
            const double factor = augmented[row][column];
            if (factor == 0.0) continue;
            for (int j = 0; j < 2 * n; ++j) {
                augmented[row][j] -= factor * augmented[column][j];
            }
        }
    }

    std::vector<double> heuristic(CITY_COUNT, 0.0);
    for (int i = 0; i < n; ++i) {
        heuristic[kept[i]] = std::max(0.0, augmented[i][n + i]);
    }
    const std::size_t workspace = CITY_COUNT * CITY_COUNT * 8
        + n * (2 * n) * 8 + CITY_COUNT * 8;
    return {heuristic, workspace};
}

std::pair<SearchResult, double> benchmark(
    int start, int goal, const std::vector<double>& heuristic
) {
    SearchResult result = search(start, goal, heuristic);
    std::uint64_t checksum = 0;
    const auto began = Clock::now();
    for (int run = 0; run < BENCHMARK_RUNS; ++run) {
        const SearchResult measured = search(start, goal, heuristic);
        checksum ^= static_cast<std::uint64_t>(measured.cost + measured.expanded);
    }
    const auto elapsed = std::chrono::duration<double, std::micro>(Clock::now() - began).count();
    if (checksum == std::numeric_limits<std::uint64_t>::max()) std::cerr << "unreachable\n";
    return {result, elapsed / BENCHMARK_RUNS};
}

std::string normalized(std::string value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    const auto last = value.find_last_not_of(" \t\r\n");
    value = value.substr(first, last - first + 1);
    std::transform(value.begin(), value.end(), value.begin(), [](unsigned char c) {
        return static_cast<char>(std::tolower(c));
    });
    return value;
}

int select_city(const std::string& prompt) {
    while (true) {
        std::cout << prompt;
        std::string answer;
        if (!std::getline(std::cin, answer)) throw std::runtime_error("Input ended");
        answer = normalized(answer);
        for (int city = 0; city < CITY_COUNT; ++city) {
            if (answer == normalized(CITIES[city])) return city;
        }
        std::cout << "Unknown city. Enter one of the names shown above.\n";
    }
}

std::string path_text(const SearchResult& result) {
    std::string text;
    for (std::size_t i = 0; i < result.path.size(); ++i) {
        if (i) text += " -> ";
        text += CITIES[result.path[i]];
    }
    return text;
}

std::string explored_text(const SearchResult& result) {
    std::string text;
    for (std::size_t i = 0; i < result.explored_order.size(); ++i) {
        if (i) text += " -> ";
        text += CITIES[result.explored_order[i]];
    }
    return text;
}

int main() {
    try {
        std::cout << "Romania map (20 cities):\n";
        for (int i = 0; i < CITY_COUNT; ++i) {
            if (i) std::cout << ", ";
            std::cout << CITIES[i];
        }
        std::cout << '\n';
        const int start = select_city("Current city: ");
        const int goal = select_city("Goal city: ");

        const auto build_start = Clock::now();
        const HeuristicResult heuristic = current_flow_heuristic(goal);
        const double build_us = std::chrono::duration<double, std::micro>(
            Clock::now() - build_start
        ).count();

        const auto [ucs, ucs_us] = benchmark(start, goal, std::vector<double>(CITY_COUNT, 0.0));
        const auto [astar, astar_us] = benchmark(start, goal, heuristic.values);

        std::cout << "\nRoutes\n"
                  << "UCS:             " << path_text(ucs) << " (cost " << ucs.cost << " km)\n"
                  << "Current-flow A*: " << path_text(astar) << " (cost " << astar.cost << " km)\n"
                  << "\nExplored order\n"
                  << "UCS:             " << explored_text(ucs) << '\n'
                  << "Current-flow A*: " << explored_text(astar) << '\n'
                  << "\nAverage search time over " << BENCHMARK_RUNS
                  << " runs (heuristic build excluded)\n"
                  << std::left << std::setw(18) << "Algorithm" << std::right
                  << std::setw(14) << "Runtime (us)" << std::setw(11) << "Expanded"
                  << std::setw(11) << "Generated" << std::setw(12) << "Peak queue"
                  << std::setw(14) << "Peak records" << std::setw(14) << "Memory (B)" << '\n';

        auto print_row = [](const std::string& name, const SearchResult& result, double time_us) {
            std::cout << std::left << std::setw(18) << name << std::right << std::fixed
                      << std::setprecision(3) << std::setw(14) << time_us
                      << std::setw(11) << result.expanded << std::setw(11) << result.generated
                      << std::setw(12) << result.peak_frontier << std::setw(14) << result.peak_records
                      << std::setw(14) << result.peak_payload_bytes << '\n';
        };
        print_row("UCS", ucs, ucs_us);
        print_row("Current-flow A*", astar, astar_us);
        std::cout << "\nA* heuristic build: " << std::fixed << std::setprecision(3) << build_us
                  << " us; logical numeric workspace: " << heuristic.logical_workspace_bytes << " bytes\n"
                  << "Units: runtime is microseconds (us); logical search memory is bytes (B).\n"
                  << "Memory is a language-neutral count of stored fields; runtime/container overhead is excluded.\n";
        if (ucs.cost == astar.cost) std::cout << "Both algorithms found the same optimal route cost.\n";
    } catch (const std::exception& error) {
        std::cerr << "Error: " << error.what() << '\n';
        return 1;
    }
    return 0;
}
