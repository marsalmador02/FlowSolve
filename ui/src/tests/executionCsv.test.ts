import { describe, expect, it } from "vitest";
import { buildExecutionCsvFromGraph, getProblemInstanceName } from "../utils/executionCsv";

import type { FlowNode, FlowEdge } from "../types/flow";

describe("executionCsv", () => {
  it("extracts the instance name", () => {
    expect(getProblemInstanceName('{"name":"knapsack"}')).toBe("knapsack");
  });

  it("returns unknown_instance for invalid JSON", () => {
    expect(getProblemInstanceName("{")).toBe("unknown_instance");
  });

  it("creates a CSV with a header", () => {
    const nodes: FlowNode[] = [
      {
        id: "termination",
        type: "termination",
        position: { x: 0, y: 0 },
        data: {
          label: "Loop",
          end: true,
          maxIterations: 2,
          history: [10, 8],
        },
      } as FlowNode,
    ];

    const edges: FlowEdge[] = [];

    const csv = buildExecutionCsvFromGraph({
      nodes,
      edges,
      instance: "knapsack",
    });

    expect(csv.startsWith("Algorithm")).toBe(true);
    expect(csv).toContain("knapsack");
  });
});