// lib/romaniaGraph.ts
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
  { id: 0, name: "Arad", x: 233.4, y: 347.4 },
  { id: 1, name: "Zerind", x: 252.3, y: 290.2 },
  { id: 2, name: "Oradea", x: 289.2, y: 234.6 },
  { id: 3, name: "Sibiu", x: 492.0, y: 398.3 },
  { id: 4, name: "Timisoara", x: 223.9, y: 404.8 },
  { id: 5, name: "Lugoj", x: 287.7, y: 412.4 },
  { id: 6, name: "Mehadia", x: 330.1, y: 515.7 },
  { id: 7, name: "Drobeta", x: 357.3, y: 550.6 },
  { id: 8, name: "Craiova", x: 461.6, y: 590.9 },
  { id: 9, name: "Rimnicu Vilcea", x: 515.0, y: 489.3 },
  { id: 10, name: "Pitesti", x: 560.4, y: 521.8 },
  { id: 11, name: "Fagaras", x: 569.9, y: 392.6 },
  { id: 12, name: "Bucharest", x: 673.8, y: 578.2 },
  { id: 13, name: "Giurgiu", x: 661.6, y: 646.8 },
  { id: 14, name: "Urziceni", x: 722.5, y: 540.2 },
  { id: 15, name: "Hirsova", x: 843.6, y: 544.6 },
  { id: 16, name: "Eforie", x: 906.4, y: 626.0 },
  { id: 17, name: "Vaslui", x: 823.1, y: 287.8 },
  { id: 18, name: "Iasi", x: 811.5, y: 219.9 },
  { id: 19, name: "Neamt", x: 699.3, y: 243.9 },
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
