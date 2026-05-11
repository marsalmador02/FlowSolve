// JSON templates used to preload example optimization problems in the UI.

// TODO: estilizar la vista del problem en el sidebar?

export const KNAPSACK_TEMPLATE_JSON = `{
  "name": "BinaryKnapsack1",
  "description": "Optional description (optimal: 130)",
  "parameters": [
    {"name": "Number of items", "symbol": "N", "value": 5},
    {"name": "Maximum weight", "symbol": "MaxWeight", "value": 80}
  ],
  "variables": [
    {
      "name": "Items in the knapsack",
      "symbol": "x",
      "within": "integers",
      "range": {"lowerBound": 0, "upperBound": 1},
      "shape": {
        "type": "vector",
        "isPermutation": false,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Maximize the value of the items",
      "sense": "maximize",
      "expression": "sum x[i]*item[i].value over i=(1:N)",
      "weight": 1
    }
  ],
  "constraints": [
    {
      "name": "Limit the total weight of the items in the knapsack",
      "expression": "sum x[i]*item[i].weight over i=(1:N) <= MaxWeight"
    }
  ],
  "classes": [
    {
      "name": "Item",
      "symbol": "item",
      "attributes": [
        {"name": "Name", "symbol": "name"},
        {"name": "Value", "symbol": "value"},
        {"name": "Weight", "symbol": "weight"}
      ]
    }
  ],
  "objects": [
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 1"}, {"attribute": "value", "value": 33}, {"attribute": "weight", "value": 15}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 2"}, {"attribute": "value", "value": 24}, {"attribute": "weight", "value": 20}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 3"}, {"attribute": "value", "value": 36}, {"attribute": "weight", "value": 17}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 4"}, {"attribute": "value", "value": 37}, {"attribute": "weight", "value": 8}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 5"}, {"attribute": "value", "value": 12}, {"attribute": "weight", "value": 31}]}
  ]
}`;

export const TSP_TEMPLATE_JSON = `{
  "name": "TSP1",
  "description": "TSP instance from the document",
  "parameters": [
    {"name": "Number of cities", "symbol": "N", "value": 4}
  ],
  "variables": [
    {
      "name": "Visited cities",
      "symbol": "city",
      "within": "integers",
      "shape": {
        "type": "vector",
        "isPermutation": true,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Minimize the distance traveled",
      "sense": "minimize",
      "expression": "sum distance[city[i], city[i+1]] over i=(1:N-1) + distance[city[N], city[1]]",
      "weight": 1
    }
  ],
  "classes": [
    {
      "name": "Distance between cities",
      "symbol": "distance",
      "attributes": [
        {"name": "Distance with city 1", "symbol": "dist_c1"},
        {"name": "Distance with city 2", "symbol": "dist_c2"},
        {"name": "Distance with city 3", "symbol": "dist_c3"},
        {"name": "Distance with city 4", "symbol": "dist_c4"}
      ]
    }
  ],
  "objects": [
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 0}, {"attribute": "dist_c2", "value": 12}, {"attribute": "dist_c3", "value": 25}, {"attribute": "dist_c4", "value": 17}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 12}, {"attribute": "dist_c2", "value": 0}, {"attribute": "dist_c3", "value": 35}, {"attribute": "dist_c4", "value": 8}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 25}, {"attribute": "dist_c2", "value": 35}, {"attribute": "dist_c3", "value": 0}, {"attribute": "dist_c4", "value": 11}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 17}, {"attribute": "dist_c2", "value": 8}, {"attribute": "dist_c3", "value": 11}, {"attribute": "dist_c4", "value": 0}]}
  ]
}`;

export const KNAPSACK_COMPLEX_TEMPLATE_JSON = `{
  "name": "BinaryKnapsack2",
  "description": "Larger instance with 15 items and broader value/weight ranges.",
  "parameters": [
    {"name": "Number of items", "symbol": "N", "value": 15},
    {"name": "Maximum weight", "symbol": "MaxWeight", "value": 240}
  ],
  "variables": [
    {
      "name": "Items in the knapsack",
      "symbol": "x",
      "within": "integers",
      "range": {"lowerBound": 0, "upperBound": 1},
      "shape": {
        "type": "vector",
        "isPermutation": false,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Maximize the value of the items",
      "sense": "maximize",
      "expression": "sum x[i]*item[i].value over i=(1:N)",
      "weight": 1
    }
  ],
  "constraints": [
    {
      "name": "Limit the total weight of the items in the knapsack",
      "expression": "sum x[i]*item[i].weight over i=(1:N) <= MaxWeight"
    }
  ],
  "classes": [
    {
      "name": "Item",
      "symbol": "item",
      "attributes": [
        {"name": "Name", "symbol": "name"},
        {"name": "Value", "symbol": "value"},
        {"name": "Weight", "symbol": "weight"}
      ]
    }
  ],
  "objects": [
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 1"}, {"attribute": "value", "value": 102}, {"attribute": "weight", "value": 45}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 2"}, {"attribute": "value", "value": 84}, {"attribute": "weight", "value": 60}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 3"}, {"attribute": "value", "value": 111}, {"attribute": "weight", "value": 52}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 4"}, {"attribute": "value", "value": 123}, {"attribute": "weight", "value": 26}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 5"}, {"attribute": "value", "value": 39}, {"attribute": "weight", "value": 93}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 6"}, {"attribute": "value", "value": 96}, {"attribute": "weight", "value": 41}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 7"}, {"attribute": "value", "value": 57}, {"attribute": "weight", "value": 38}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 8"}, {"attribute": "value", "value": 141}, {"attribute": "weight", "value": 71}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 9"}, {"attribute": "value", "value": 75}, {"attribute": "weight", "value": 29}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 10"}, {"attribute": "value", "value": 129}, {"attribute": "weight", "value": 66}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 11"}, {"attribute": "value", "value": 90}, {"attribute": "weight", "value": 35}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 12"}, {"attribute": "value", "value": 117}, {"attribute": "weight", "value": 58}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 13"}, {"attribute": "value", "value": 63}, {"attribute": "weight", "value": 33}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 14"}, {"attribute": "value", "value": 135}, {"attribute": "weight", "value": 74}]},
    {"class": "item", "attributes": [{"attribute": "name", "value": "Item 15"}, {"attribute": "value", "value": 108}, {"attribute": "weight", "value": 47}]}
  ]
}`;

export const TSP_COMPLEX_TEMPLATE_JSON = `{
  "name": "TSP2",
  "description": "12-city TSP with larger edge costs.",
  "parameters": [
    {"name": "Number of cities", "symbol": "N", "value": 12}
  ],
  "variables": [
    {
      "name": "Visited cities",
      "symbol": "city",
      "within": "integers",
      "shape": {
        "type": "vector",
        "isPermutation": true,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Minimize the distance traveled",
      "sense": "minimize",
      "expression": "sum distance[city[i], city[i+1]] over i=(1:N-1) + distance[city[N], city[1]]",
      "weight": 1
    }
  ],
  "classes": [
    {
      "name": "Distance between cities",
      "symbol": "distance",
      "attributes": [
        {"name": "Distance with city 1", "symbol": "dist_c1"},
        {"name": "Distance with city 2", "symbol": "dist_c2"},
        {"name": "Distance with city 3", "symbol": "dist_c3"},
        {"name": "Distance with city 4", "symbol": "dist_c4"},
        {"name": "Distance with city 5", "symbol": "dist_c5"},
        {"name": "Distance with city 6", "symbol": "dist_c6"},
        {"name": "Distance with city 7", "symbol": "dist_c7"},
        {"name": "Distance with city 8", "symbol": "dist_c8"},
        {"name": "Distance with city 9", "symbol": "dist_c9"},
        {"name": "Distance with city 10", "symbol": "dist_c10"},
        {"name": "Distance with city 11", "symbol": "dist_c11"},
        {"name": "Distance with city 12", "symbol": "dist_c12"}
      ]
    }
  ],
  "objects": [
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 0}, {"attribute": "dist_c2", "value": 38}, {"attribute": "dist_c3", "value": 75}, {"attribute": "dist_c4", "value": 51}, {"attribute": "dist_c5", "value": 62}, {"attribute": "dist_c6", "value": 84}, {"attribute": "dist_c7", "value": 93}, {"attribute": "dist_c8", "value": 47}, {"attribute": "dist_c9", "value": 69}, {"attribute": "dist_c10", "value": 105}, {"attribute": "dist_c11", "value": 58}, {"attribute": "dist_c12", "value": 72}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 38}, {"attribute": "dist_c2", "value": 0}, {"attribute": "dist_c3", "value": 89}, {"attribute": "dist_c4", "value": 33}, {"attribute": "dist_c5", "value": 71}, {"attribute": "dist_c6", "value": 64}, {"attribute": "dist_c7", "value": 87}, {"attribute": "dist_c8", "value": 59}, {"attribute": "dist_c9", "value": 42}, {"attribute": "dist_c10", "value": 96}, {"attribute": "dist_c11", "value": 61}, {"attribute": "dist_c12", "value": 78}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 75}, {"attribute": "dist_c2", "value": 89}, {"attribute": "dist_c3", "value": 0}, {"attribute": "dist_c4", "value": 67}, {"attribute": "dist_c5", "value": 54}, {"attribute": "dist_c6", "value": 92}, {"attribute": "dist_c7", "value": 43}, {"attribute": "dist_c8", "value": 88}, {"attribute": "dist_c9", "value": 73}, {"attribute": "dist_c10", "value": 57}, {"attribute": "dist_c11", "value": 99}, {"attribute": "dist_c12", "value": 66}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 51}, {"attribute": "dist_c2", "value": 33}, {"attribute": "dist_c3", "value": 67}, {"attribute": "dist_c4", "value": 0}, {"attribute": "dist_c5", "value": 46}, {"attribute": "dist_c6", "value": 58}, {"attribute": "dist_c7", "value": 79}, {"attribute": "dist_c8", "value": 41}, {"attribute": "dist_c9", "value": 55}, {"attribute": "dist_c10", "value": 83}, {"attribute": "dist_c11", "value": 49}, {"attribute": "dist_c12", "value": 62}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 62}, {"attribute": "dist_c2", "value": 71}, {"attribute": "dist_c3", "value": 54}, {"attribute": "dist_c4", "value": 46}, {"attribute": "dist_c5", "value": 0}, {"attribute": "dist_c6", "value": 77}, {"attribute": "dist_c7", "value": 68}, {"attribute": "dist_c8", "value": 52}, {"attribute": "dist_c9", "value": 39}, {"attribute": "dist_c10", "value": 90}, {"attribute": "dist_c11", "value": 64}, {"attribute": "dist_c12", "value": 56}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 84}, {"attribute": "dist_c2", "value": 64}, {"attribute": "dist_c3", "value": 92}, {"attribute": "dist_c4", "value": 58}, {"attribute": "dist_c5", "value": 77}, {"attribute": "dist_c6", "value": 0}, {"attribute": "dist_c7", "value": 85}, {"attribute": "dist_c8", "value": 73}, {"attribute": "dist_c9", "value": 66}, {"attribute": "dist_c10", "value": 48}, {"attribute": "dist_c11", "value": 81}, {"attribute": "dist_c12", "value": 95}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 93}, {"attribute": "dist_c2", "value": 87}, {"attribute": "dist_c3", "value": 43}, {"attribute": "dist_c4", "value": 79}, {"attribute": "dist_c5", "value": 68}, {"attribute": "dist_c6", "value": 85}, {"attribute": "dist_c7", "value": 0}, {"attribute": "dist_c8", "value": 91}, {"attribute": "dist_c9", "value": 74}, {"attribute": "dist_c10", "value": 63}, {"attribute": "dist_c11", "value": 97}, {"attribute": "dist_c12", "value": 53}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 47}, {"attribute": "dist_c2", "value": 59}, {"attribute": "dist_c3", "value": 88}, {"attribute": "dist_c4", "value": 41}, {"attribute": "dist_c5", "value": 52}, {"attribute": "dist_c6", "value": 73}, {"attribute": "dist_c7", "value": 91}, {"attribute": "dist_c8", "value": 0}, {"attribute": "dist_c9", "value": 57}, {"attribute": "dist_c10", "value": 76}, {"attribute": "dist_c11", "value": 44}, {"attribute": "dist_c12", "value": 69}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 69}, {"attribute": "dist_c2", "value": 42}, {"attribute": "dist_c3", "value": 73}, {"attribute": "dist_c4", "value": 55}, {"attribute": "dist_c5", "value": 39}, {"attribute": "dist_c6", "value": 66}, {"attribute": "dist_c7", "value": 74}, {"attribute": "dist_c8", "value": 57}, {"attribute": "dist_c9", "value": 0}, {"attribute": "dist_c10", "value": 82}, {"attribute": "dist_c11", "value": 60}, {"attribute": "dist_c12", "value": 50}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 105}, {"attribute": "dist_c2", "value": 96}, {"attribute": "dist_c3", "value": 57}, {"attribute": "dist_c4", "value": 83}, {"attribute": "dist_c5", "value": 90}, {"attribute": "dist_c6", "value": 48}, {"attribute": "dist_c7", "value": 63}, {"attribute": "dist_c8", "value": 76}, {"attribute": "dist_c9", "value": 82}, {"attribute": "dist_c10", "value": 0}, {"attribute": "dist_c11", "value": 88}, {"attribute": "dist_c12", "value": 71}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 58}, {"attribute": "dist_c2", "value": 61}, {"attribute": "dist_c3", "value": 99}, {"attribute": "dist_c4", "value": 49}, {"attribute": "dist_c5", "value": 64}, {"attribute": "dist_c6", "value": 81}, {"attribute": "dist_c7", "value": 97}, {"attribute": "dist_c8", "value": 44}, {"attribute": "dist_c9", "value": 60}, {"attribute": "dist_c10", "value": 88}, {"attribute": "dist_c11", "value": 0}, {"attribute": "dist_c12", "value": 65}]},
    {"class": "distance", "attributes": [{"attribute": "dist_c1", "value": 72}, {"attribute": "dist_c2", "value": 78}, {"attribute": "dist_c3", "value": 66}, {"attribute": "dist_c4", "value": 62}, {"attribute": "dist_c5", "value": 56}, {"attribute": "dist_c6", "value": 95}, {"attribute": "dist_c7", "value": 53}, {"attribute": "dist_c8", "value": 69}, {"attribute": "dist_c9", "value": 50}, {"attribute": "dist_c10", "value": 71}, {"attribute": "dist_c11", "value": 65}, {"attribute": "dist_c12", "value": 0}]}
  ]
}`;

export const ASSIGNMENT_TEMPLATE_JSON = `{
  "name": "Assignment1",
  "description": "4x4 worker-task assignment problem",
  "parameters": [
    {"name": "Number of workers/tasks", "symbol": "N", "value": 4}
  ],
  "variables": [
    {
      "name": "Task assigned to each worker",
      "symbol": "assignment",
      "within": "integers",
      "shape": {
        "type": "vector",
        "isPermutation": true,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Minimize total assignment cost",
      "sense": "minimize",
      "expression": "sum cost[i, assignment[i]] over i=(1:N)",
      "weight": 1
    }
  ],
  "classes": [
    {
      "name": "Cost matrix worker->task",
      "symbol": "cost",
      "attributes": [
        {"name": "Task 1 cost", "symbol": "task_1"},
        {"name": "Task 2 cost", "symbol": "task_2"},
        {"name": "Task 3 cost", "symbol": "task_3"},
        {"name": "Task 4 cost", "symbol": "task_4"}
      ]
    }
  ],
  "objects": [
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 14}, {"attribute": "task_2", "value": 5}, {"attribute": "task_3", "value": 8}, {"attribute": "task_4", "value": 7}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 2}, {"attribute": "task_2", "value": 12}, {"attribute": "task_3", "value": 6}, {"attribute": "task_4", "value": 5}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 7}, {"attribute": "task_2", "value": 8}, {"attribute": "task_3", "value": 3}, {"attribute": "task_4", "value": 9}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 2}, {"attribute": "task_2", "value": 4}, {"attribute": "task_3", "value": 6}, {"attribute": "task_4", "value": 10}]}
  ]
}`;

export const ASSIGNMENT_COMPLEX_TEMPLATE_JSON = `{
  "name": "Assignment2",
  "description": "9x9 worker-task assignment with wider costs",
  "parameters": [
    {"name": "Number of workers/tasks", "symbol": "N", "value": 9}
  ],
  "variables": [
    {
      "name": "Task assigned to each worker",
      "symbol": "assignment",
      "within": "integers",
      "shape": {
        "type": "vector",
        "isPermutation": true,
        "size": {"fixed": false, "value": "N"}
      }
    }
  ],
  "goals": [
    {
      "name": "Minimize total assignment cost",
      "sense": "minimize",
      "expression": "sum cost[i, assignment[i]] over i=(1:N)",
      "weight": 1
    }
  ],
  "classes": [
    {
      "name": "Cost matrix worker->task",
      "symbol": "cost",
      "attributes": [
        {"name": "Task 1 cost", "symbol": "task_1"},
        {"name": "Task 2 cost", "symbol": "task_2"},
        {"name": "Task 3 cost", "symbol": "task_3"},
        {"name": "Task 4 cost", "symbol": "task_4"},
        {"name": "Task 5 cost", "symbol": "task_5"},
        {"name": "Task 6 cost", "symbol": "task_6"},
        {"name": "Task 7 cost", "symbol": "task_7"},
        {"name": "Task 8 cost", "symbol": "task_8"},
        {"name": "Task 9 cost", "symbol": "task_9"}
      ]
    }
  ],
  "objects": [
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 21}, {"attribute": "task_2", "value": 13}, {"attribute": "task_3", "value": 9}, {"attribute": "task_4", "value": 17}, {"attribute": "task_5", "value": 26}, {"attribute": "task_6", "value": 11}, {"attribute": "task_7", "value": 19}, {"attribute": "task_8", "value": 23}, {"attribute": "task_9", "value": 15}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 8}, {"attribute": "task_2", "value": 24}, {"attribute": "task_3", "value": 14}, {"attribute": "task_4", "value": 19}, {"attribute": "task_5", "value": 10}, {"attribute": "task_6", "value": 22}, {"attribute": "task_7", "value": 16}, {"attribute": "task_8", "value": 18}, {"attribute": "task_9", "value": 27}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 17}, {"attribute": "task_2", "value": 12}, {"attribute": "task_3", "value": 20}, {"attribute": "task_4", "value": 11}, {"attribute": "task_5", "value": 25}, {"attribute": "task_6", "value": 15}, {"attribute": "task_7", "value": 13}, {"attribute": "task_8", "value": 28}, {"attribute": "task_9", "value": 9}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 14}, {"attribute": "task_2", "value": 18}, {"attribute": "task_3", "value": 11}, {"attribute": "task_4", "value": 26}, {"attribute": "task_5", "value": 16}, {"attribute": "task_6", "value": 21}, {"attribute": "task_7", "value": 24}, {"attribute": "task_8", "value": 10}, {"attribute": "task_9", "value": 19}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 23}, {"attribute": "task_2", "value": 9}, {"attribute": "task_3", "value": 18}, {"attribute": "task_4", "value": 15}, {"attribute": "task_5", "value": 12}, {"attribute": "task_6", "value": 27}, {"attribute": "task_7", "value": 20}, {"attribute": "task_8", "value": 14}, {"attribute": "task_9", "value": 22}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 10}, {"attribute": "task_2", "value": 22}, {"attribute": "task_3", "value": 16}, {"attribute": "task_4", "value": 24}, {"attribute": "task_5", "value": 19}, {"attribute": "task_6", "value": 13}, {"attribute": "task_7", "value": 17}, {"attribute": "task_8", "value": 25}, {"attribute": "task_9", "value": 11}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 19}, {"attribute": "task_2", "value": 15}, {"attribute": "task_3", "value": 25}, {"attribute": "task_4", "value": 13}, {"attribute": "task_5", "value": 18}, {"attribute": "task_6", "value": 16}, {"attribute": "task_7", "value": 12}, {"attribute": "task_8", "value": 21}, {"attribute": "task_9", "value": 14}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 16}, {"attribute": "task_2", "value": 20}, {"attribute": "task_3", "value": 12}, {"attribute": "task_4", "value": 22}, {"attribute": "task_5", "value": 14}, {"attribute": "task_6", "value": 19}, {"attribute": "task_7", "value": 26}, {"attribute": "task_8", "value": 11}, {"attribute": "task_9", "value": 17}]},
    {"class": "cost", "attributes": [{"attribute": "task_1", "value": 13}, {"attribute": "task_2", "value": 17}, {"attribute": "task_3", "value": 21}, {"attribute": "task_4", "value": 10}, {"attribute": "task_5", "value": 23}, {"attribute": "task_6", "value": 14}, {"attribute": "task_7", "value": 15}, {"attribute": "task_8", "value": 24}, {"attribute": "task_9", "value": 18}]}
  ]
}`;
