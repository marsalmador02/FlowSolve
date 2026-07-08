import { expect, it, vi } from "vitest";
import { buildAlgorithmTemplate } from "../engine/algorithms/algorithmBuilder.js";

it("builds the GRASP template", () => {
    const update = vi.fn();

    const result = buildAlgorithmTemplate("grasp", update);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);

    expect(result.nodes.length).equal(6);

    expect(result.nodes.some(n => n.type === "problem")).toBe(true);
    expect(result.nodes.some(n => n.type === "singleSolution")).toBe(true);
    expect(result.nodes.some(n => n.type === "localSearch")).toBe(true);
    expect(result.nodes.some(n => n.type === "acceptance")).toBe(true);
    expect(result.nodes.some(n => n.type === "termination")).toBe(true);
    expect(result.nodes.some(e => e.type === "storage")).toBe(true);

    expect(result.edges.some(e => e.source === "termination-template" && e.target === "single-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "storage-template")).toBe(true);
    expect(result.edges.some(e => e.source === "single-template" && e.target === "local-template")).toBe(true);
    expect(result.edges.some(e => e.source === "storage-template" && e.target === "acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "acceptance-template" && e.target === "termination-template")).toBe(true);
});

it("builds the ILS template", () => {
    const update = vi.fn();

    const result = buildAlgorithmTemplate("ils", update);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);

    expect(result.nodes.length).equal(6);

    expect(result.nodes.some(n => n.type === "problem")).toBe(true);
    expect(result.nodes.some(n => n.type === "singleSolution")).toBe(true);
    expect(result.nodes.some(n => n.type === "localSearch")).toBe(true);
    expect(result.nodes.some(n => n.type === "acceptance")).toBe(true);
    expect(result.nodes.some(n => n.type === "termination")).toBe(true);
    expect(result.nodes.some(e => e.type === "perturbation")).toBe(true);

    expect(result.edges.some(e => e.source === "single-template" && e.target === "termination-template")).toBe(true);
    expect(result.edges.some(e => e.source === "perturbation-template" && e.target === "local-template")).toBe(true);
    expect(result.edges.some(e => e.source === "local-template" && e.target === "acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "acceptance-template" && e.target === "termination-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "perturbation-template")).toBe(true);
});

it("builds the VNS template", () => {
    const update = vi.fn();

    const result = buildAlgorithmTemplate("vns", update);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);

    expect(result.nodes.length).equal(7);

    expect(result.nodes.some(n => n.type === "problem")).toBe(true);
    expect(result.nodes.some(n => n.type === "singleSolution")).toBe(true);
    expect(result.nodes.some(n => n.type === "localSearch")).toBe(true);
    expect(result.nodes.some(n => n.type === "acceptance")).toBe(true);
    expect(result.nodes.some(n => n.type === "termination")).toBe(true);
    expect(result.nodes.some(e => e.type === "perturbation")).toBe(true);
    expect(result.nodes.some(e => e.type === "changeNeighborhood")).toBe(true);

    expect(result.edges.some(e => e.source === "single-template" && e.target === "termination-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "perturbation-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "neighborhood-template")).toBe(true);
    expect(result.edges.some(e => e.source === "perturbation-template" && e.target === "local-template")).toBe(true);
    expect(result.edges.some(e => e.source === "local-template" && e.target === "acceptance-template")).toBe(true); 
    expect(result.edges.some(e => e.source === "acceptance-template" && e.target === "neighborhood-template")).toBe(true);
    expect(result.edges.some(e => e.source === "neighborhood-template" && e.target === "termination-template")).toBe(true);
});

it("builds the Tabu Search template", () => {
    const update = vi.fn();

    const result = buildAlgorithmTemplate("tabu", update);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);

    expect(result.nodes.length).equal(7);

    expect(result.nodes.some(n => n.type === "problem")).toBe(true);
    expect(result.nodes.some(n => n.type === "singleSolution")).toBe(true);
    expect(result.nodes.some(n => n.type === "termination")).toBe(true);
    expect(result.nodes.some(n => n.type === "neighborhood")).toBe(true);
    expect(result.nodes.some(n => n.type === "storage")).toBe(true);
    expect(result.nodes.some(n => n.type === "subtraction")).toBe(true);
    expect(result.nodes.some(e => e.type === "selectionBest")).toBe(true);

    expect(result.edges.some(e => e.source === "single-template" && e.target === "termination-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "storage-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "neighborhood-template")).toBe(true);
    expect(result.edges.some(e => e.source === "subtraction-template" && e.target === "selection-template")).toBe(true);
    expect(result.edges.some(e => e.source === "selection-template" && e.target === "termination-template")).toBe(true);
});

it("builds the Simulated Annealing template", () => {
    const update = vi.fn();

    const result = buildAlgorithmTemplate("simulatedAnnealing", update);

    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);

    expect(result.nodes.length).equal(7);

    expect(result.nodes.some(n => n.type === "problem")).toBe(true);
    expect(result.nodes.some(n => n.type === "singleSolution")).toBe(true);
    expect(result.nodes.some(n => n.type === "perturbation")).toBe(true);
    expect(result.nodes.some(n => n.type === "termination")).toBe(true);
    expect(result.nodes.some(e => e.type === "temperatureAcceptance")).toBe(true);
    expect(result.nodes.some(e => e.type === "storage")).toBe(true);

    expect(result.edges.some(e => e.source === "single-template" && e.target === "termination-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "storage-template")).toBe(true);
    expect(result.edges.some(e => e.source === "termination-template" && e.target === "perturbation-template")).toBe(true);
    expect(result.edges.some(e => e.source === "perturbation-template" && e.target === "temperature-acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "storage-template" && e.target === "temperature-acceptance-template")).toBe(true);
    expect(result.edges.some(e => e.source === "temperature-acceptance-template" && e.target === "reduce-temperature-template")).toBe(true);
    expect(result.edges.some(e => e.source === "reduce-temperature-template" && e.target === "termination-template")).toBe(true);
});