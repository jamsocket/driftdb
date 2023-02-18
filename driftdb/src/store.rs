use crate::types::{Action, Key, SequenceNumber, SequenceValue};
use serde_json::Value;
use std::collections::{HashMap, VecDeque};

#[derive(Default)]
struct ValueLog {
    values: VecDeque<SequenceValue>,
}

#[derive(Default)]
pub struct Store {
    subjects: HashMap<Key, ValueLog>,
    sequence_number: SequenceNumber,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum DeleteInstruction {
    /// Delete all values for the given subject.
    Delete,

    /// Delete all values for the given subject up to the given sequence number.
    DeleteUpTo(SequenceNumber),
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum PushInstruction {
    /// Push the given value to the end of the subject.
    Push(SequenceValue),

    /// Push the given value to the start of the subject.
    PushStart(SequenceValue),
}

#[derive(Clone)]
pub struct ApplyResult {
    pub key: Key,

    /// Optional instruction to remove some or all existing values.
    pub delete_instruction: Option<DeleteInstruction>,

    /// Optional instruction to push a value to the subject.
    pub push_instruction: Option<PushInstruction>,

    /// Optional value to broadcast to clients.
    pub broadcast: Option<SequenceValue>,

    /// The number of retained records for the given subject after applying the action.
    pub stream_size: usize,
}

impl ApplyResult {
    pub fn mutates(&self) -> bool {
        self.delete_instruction.is_some() || self.push_instruction.is_some()
    }
}

impl Store {
    fn next_seq(&mut self) -> SequenceNumber {
        self.sequence_number.0 += 1;
        self.sequence_number
    }

    pub fn dump(&self) -> HashMap<Key, Vec<SequenceValue>> {
        self.subjects
            .iter()
            .map(|(k, v)| (k.clone(), v.values.iter().cloned().collect()))
            .collect()
    }

    pub fn get(&self, key: &Key, min_sequence: SequenceNumber) -> Vec<SequenceValue> {
        let Some(log) = self.subjects
            .get(key) else {
                return vec![];
            };

        log.values
            .iter()
            .filter(|d| d.seq > min_sequence)
            .cloned()
            .collect()
    }

    pub fn apply(&mut self, key: &Key, value: Value, action: &Action) -> ApplyResult {
        let mut result = match action {
            Action::Append => {
                let seq = self.next_seq();
                let value = SequenceValue { value, seq };

                ApplyResult {
                    key: key.clone(),
                    delete_instruction: None,
                    push_instruction: Some(PushInstruction::Push(value.clone())),
                    broadcast: Some(value),
                    stream_size: 0,
                }
            }
            Action::Replace => {
                let seq = self.next_seq();
                let value = SequenceValue { value, seq };

                ApplyResult {
                    key: key.clone(),
                    delete_instruction: Some(DeleteInstruction::Delete),
                    push_instruction: Some(PushInstruction::Push(value.clone())),
                    broadcast: Some(value),
                    stream_size: 0,
                }
            }
            Action::Compact { seq } => ApplyResult {
                key: key.clone(),
                delete_instruction: Some(DeleteInstruction::DeleteUpTo(*seq)),
                push_instruction: Some(PushInstruction::PushStart(SequenceValue {
                    value,
                    seq: *seq,
                })),
                broadcast: None,
                stream_size: 0,
            },
            Action::Relay => {
                let seq = self.next_seq();
                ApplyResult {
                    key: key.clone(),
                    delete_instruction: None,
                    push_instruction: None,
                    broadcast: Some(SequenceValue { value, seq }),
                    stream_size: 0,
                }
            }
        };

        match &result.delete_instruction {
            Some(DeleteInstruction::Delete) => {
                let value_log = self.subjects.entry(key.clone()).or_default();
                value_log.values.clear();
            }
            Some(DeleteInstruction::DeleteUpTo(seq)) => {
                let value_log = self.subjects.entry(key.clone()).or_default();
                value_log.values.retain(|v| v.seq > *seq);
            }
            None => {}
        }

        match &result.push_instruction {
            Some(PushInstruction::Push(value)) => {
                let value_log = self.subjects.entry(key.clone()).or_default();
                value_log.values.push_back(value.clone());
            }
            Some(PushInstruction::PushStart(value)) => {
                let value_log = self.subjects.entry(key.clone()).or_default();
                value_log.values.push_front(value.clone());
            }
            None => {}
        }

        result.stream_size = self.subjects.get(key).map(|v| v.values.len()).unwrap_or(0);

        result
    }
}
