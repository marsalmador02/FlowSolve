import { expect, it } from "vitest";
import { createComponent, isExecutableKind } from "../src/flow/runtime/components/registry.ts";

it("creates a Local Search component", () => {
    const component = createComponent("localSearch");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("LocalSearchComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Storage component", () => {
    const component = createComponent("storage");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("StorageComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Loop component", () => {
    const component = createComponent("termination");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("LoopComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Single Generator component", () => {
    const component = createComponent("singleSolution");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("SingleGeneratorComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Selection Best component", () => {
    const component = createComponent("selectionBest");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("SelectionBestComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Neighborhood component", () => {
    const component = createComponent("neighborhood");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("NeighborhoodComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Perturbation component", () => {
    const component = createComponent("perturbation");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("PerturbationComponent");
    expect(component?.arity).toBe(1);
});

it("creates an Acceptance component", () => {
    const component = createComponent("acceptance");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("AcceptanceComponent");
    expect(component?.arity).toBe(2);
});

it("creates a Subtraction component", () => {
    const component = createComponent("subtraction");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("SubtractionComponent");
    expect(component?.arity).toBe(2);
});

it("creates a Temperature Acceptance component", () => {
    const component = createComponent("temperatureAcceptance");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("TemperatureAcceptanceComponent");
    expect(component?.arity).toBe(2);
});

it("creates a Reduce Temperature component", () => {
    const component = createComponent("reduceTemperature");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("ReduceTemperatureComponent");
    expect(component?.arity).toBe(1);
});

it("creates a Change Neighborhood component", () => {
    const component = createComponent("changeNeighborhood");
    expect(component).not.toBeNull();
    expect(component?.constructor.name).toBe("ChangeNeighbourhoodComponent");
    expect(component?.arity).toBe(2);
});

it("returns null for unknown node kinds", () => {
    const component = createComponent("unknownKind" as any);
    expect(component).toBeNull();
});

it("recognizes executable node kinds", () => {
    expect(isExecutableKind("storage")).toBe(true);
    expect(isExecutableKind("localSearch")).toBe(true);
    expect(isExecutableKind("termination")).toBe(true);
    expect(isExecutableKind("singleSolution")).toBe(true);
    expect(isExecutableKind("selectionBest")).toBe(true);
    expect(isExecutableKind("neighborhood")).toBe(true);
    expect(isExecutableKind("perturbation")).toBe(true);
    expect(isExecutableKind("acceptance")).toBe(true);
    expect(isExecutableKind("subtraction")).toBe(true);
    expect(isExecutableKind("temperatureAcceptance")).toBe(true);
    expect(isExecutableKind("reduceTemperature")).toBe(true);
    expect(isExecutableKind("changeNeighborhood")).toBe(true);

    expect(isExecutableKind("problem")).toBe(false);
    expect(isExecutableKind("" as any)).toBe(false);
});