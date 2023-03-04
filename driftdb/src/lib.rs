#![doc = include_str!("../README.md")]

mod connection;
mod db;
mod store;

#[cfg(test)]
mod tests;
pub mod types;

pub use db::Database;
pub use store::{StoreInstruction, DeleteInstruction, PushInstruction, Store, ValueLog};
pub use types::{Key, MessageFromDatabase, MessageToDatabase};
