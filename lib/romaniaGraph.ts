type CityPosition = {
  id: number;
  name: string;
  x: number;
  y: number;
};

type GraphData = {
  cities: CityPosition[];
  roads: [number, number, number][];
};

export const romaniaGraph: GraphData = {
  cities: [
    { id: 0, name: "Arad", x: 200, y: 257 },
    { id: 1, name: "Zerind", x: 201, y: 208 },
    { id: 2, name: "Oradea", x: 246, y: 130 },
    { id: 3, name: "Sibiu", x: 363, y: 269 },
    { id: 4, name: "Timisoara", x: 133, y: 310 },
    { id: 5, name: "Lugoj", x: 264, y: 331 },
    { id: 6, name: "Mehadia", x: 255, y: 415 },
    { id: 7, name: "Drobeta", x: 262, y: 474 },
    { id: 8, name: "Craiova", x: 370, y: 500 },
    { id: 9, name: "Rimnicu Vilcea", x: 431, y: 358 },
    { id: 10, name: "Pitesti", x: 500, y: 385 },
    { id: 11, name: "Fagaras", x: 477, y: 265 },
    { id: 12, name: "Bucharest", x: 558, y: 472 },
    { id: 13, name: "Giurgiu", x: 521, y: 541 },
    { id: 14, name: "Urziceni", x: 622, y: 413 },
    { id: 15, name: "Hirsova", x: 718, y: 404 },
    { id: 16, name: "Eforie", x: 749, y: 515 },
    { id: 17, name: "Vaslui", x: 690, y: 241 },
    { id: 18, name: "Iasi", x: 642, y: 151 },
    { id: 19, name: "Neamt", x: 546, y: 163 },
  ],
  roads: [
    [0, 1, 75], [1, 2, 71], [2, 3, 151], [0, 3, 140],
    [0, 4, 118], [4, 5, 111], [5, 6, 70], [6, 7, 75],
    [7, 8, 120], [8, 9, 146], [8, 10, 138], [3, 9, 80],
    [3, 11, 99], [9, 10, 97], [11, 12, 211], [10, 12, 101],
    [12, 13, 90], [12, 14, 85], [14, 15, 98], [15, 16, 86],
    [14, 17, 142], [17, 18, 92], [18, 19, 87],
  ],
};
