// main.rs
//
// CLI entry point. Reads a request JSON file, runs the solver, prints the
// response JSON to stdout.
//
// Usage:
//   cargo run -- --exec-request path/to/request.json

mod api;
mod eval;
mod modes;
mod problem;
mod solution;

use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use clap::Parser;

use api::{run, ExecutionRequest};

#[derive(Parser)]
struct Cli {
    #[arg(long)]
    exec_request: PathBuf,
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let raw = fs::read_to_string(&cli.exec_request)?;
    let request: ExecutionRequest = serde_json::from_str(&raw)?;
    let response = run(request)?;
    println!("{}", serde_json::to_string_pretty(&response)?);
    Ok(())
}