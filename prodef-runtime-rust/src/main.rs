mod api;
mod domain;
mod evaluation;
mod modes;
mod operators;
mod search;

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
    let request_raw = fs::read_to_string(&cli.exec_request)?;
    let request: ExecutionRequest = serde_json::from_str(&request_raw)?;
    let response = run(request)?;
    println!("{}", serde_json::to_string_pretty(&response)?);
    Ok(())
}
