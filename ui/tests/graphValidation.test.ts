import { describe, expect, it } from "vitest";
import { validateGraph } from "../src/flow/runtime/engine/graphValidation";
import type { FlowEdge, FlowNode } from "../src/types/flow";

const nodes: FlowNode[] = [
  {
    id: "start",
    type: "singleSolution",
    position: { x: 0, y: 0 },
    data: {
      label: "Start",
      start: true,
    },
  } as FlowNode,

  {
    id: "loop",
    type: "termination",
    position: { x: 100, y: 0 },
    data: {
      label: "Loop",
      end: true,
    },
  } as FlowNode,
];

const edges: FlowEdge[] = [
  {
    id: "e1",
    source: "start",
    target: "loop",
  } as FlowEdge,
];

describe("validateGraph", () => {
  it("accepts a valid graph", () => {
    const result = validateGraph(nodes, edges);

    expect(result.ok).toBe(true);
  });

  it("rejects a graph without a start node", () => {
    const invalidNodes = nodes.map((n) =>
      n.id === "start"
        ? { ...n, data: { ...n.data, start: false } }
        : n
    );

    const result = validateGraph(invalidNodes, edges);

    expect(result.ok).toBe(false);
  });

  it("rejects a graph without an end node", () => {
    const invalidNodes = nodes.map((n) =>
      n.id === "loop"
        ? { ...n, data: { ...n.data, end: false } }
        : n
    );

    const result = validateGraph(invalidNodes, edges);

    expect(result.ok).toBe(false);
  });

  it("rejects a graph without a termination node", () => {
    const result = validateGraph([nodes[0]], []);

    expect(result.ok).toBe(false);
  });
});