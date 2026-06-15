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
use anyhow::Result;
use clap::Parser;
use api::{run, ExecutionRequest};

#[derive(Parser)]
struct Args {
    #[arg(long)]
    exec_request: String,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let raw = fs::read_to_string(&args.exec_request)?;
    let request: ExecutionRequest = serde_json::from_str(&raw)?;
    let response = run(request)?;
    println!("{}", serde_json::to_string_pretty(&response)?);
    Ok(())
}