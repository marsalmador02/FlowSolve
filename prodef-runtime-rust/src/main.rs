//! # Main entry point
//!
//! This module contains the main function that reads an execution request from a JSON file, dispatches
//! to the appropriate mode handler and prints the response as JSON.

mod api;
mod eval;
mod modes;
mod problem;
mod solution;

use std::fs;
use anyhow::Result;
use clap::Parser;
use api::{run, ExecutionRequest};

/// Command-line arguments accepted by the binary.
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