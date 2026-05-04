// Component catalog published for the UI sidebar.

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub(crate) struct ComponentDescriptor {
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) category: String,
    pub(crate) stateful: bool,
}

fn make(kind: &str, label: &str, category: &str, stateful: bool) -> ComponentDescriptor {
    ComponentDescriptor {
        kind: kind.to_string(),
        label: label.to_string(),
        category: category.to_string(),
        stateful,
    }
}

pub(crate) fn builtin_component_catalog() -> Vec<ComponentDescriptor> {
    vec![
        make("problem", "Problem", "base", false),
        make("singleSolution", "Single Solution Generation", "generation", false),
        make("populationGeneration", "Population Generation", "generation", false),
        make("selection", "Selection", "evolutionary", false),
        make("crossover", "Crossover", "evolutionary", false),
        make("mutation", "Mutation", "evolutionary", false),
        make("localSearch", "Local Search", "improvement", false),
        make("perturbation", "Perturbation", "improvement", false),
        make("neighborhood", "Neighborhood", "improvement", false),
        make("substraction", "Subtraction", "improvement", false),
        make("selectionBest", "Selection Best", "improvement", false),
        make("acceptance", "Acceptance", "control", true),
        make("temperatureAcceptance", "Temperature Acceptance", "control", true),
        make("reduceTemperature", "Reduce Temperature", "control", true),
        make("changeNeighborhood", "Change Neighborhood", "control", true),
        make("storage", "Storage", "state", true),
        make("termination", "Loop/Termination", "control", true),
    ]
}
