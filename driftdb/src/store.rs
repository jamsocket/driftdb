use serde_json::Value;

use crate::{
    subject_tree::SubjectTree,
    types::{Action, SequenceNumber, SequenceValue},
    Subject,
};
use std::collections::VecDeque;

#[derive(Default)]
struct ValueLog {
    values: VecDeque<SequenceValue>,
}

#[derive(Default)]
pub struct Store {
    subjects: SubjectTree<Option<ValueLog>>,
    sequence_number: SequenceNumber,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum DeleteInstruction {
    Delete,
    DeleteUpTo(SequenceNumber),
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum PushInstruction {
    Push(SequenceValue),
    PushStart(SequenceValue),
}

pub struct ApplyResult {
    pub delete_instruction: Option<DeleteInstruction>,
    pub push_instruction: Option<PushInstruction>,
    pub broadcast: Option<SequenceValue>,

    /// The number of retained records for the given subject after applying the action.
    pub subject_size: usize,
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

    pub fn dump(&self) -> Vec<(Subject, Vec<SequenceValue>)> {
        self.subjects
            .gather_with_subject(&Subject::default())
            .into_iter()
            .map(|(k, v)| (k, v.values.iter().cloned().collect()))
            .collect()
    }

    pub fn apply(&mut self, key: &Subject, value: Value, action: &Action) -> ApplyResult {
        let mut result = match action {
            Action::Append => {
                let seq = self.next_seq();
                let value = SequenceValue {
                    value,
                    seq: Some(seq),
                };

                ApplyResult {
                    delete_instruction: None,
                    push_instruction: Some(PushInstruction::Push(value.clone())),
                    broadcast: Some(value),
                    subject_size: 0,
                }
            }
            Action::Replace => {
                let seq = self.next_seq();
                let value = SequenceValue {
                    value,
                    seq: Some(seq),
                };

                ApplyResult {
                    delete_instruction: Some(DeleteInstruction::Delete),
                    push_instruction: Some(PushInstruction::Push(value.clone())),
                    broadcast: Some(value),
                    subject_size: 0,
                }
            }
            Action::Compact { seq } => ApplyResult {
                delete_instruction: Some(DeleteInstruction::DeleteUpTo(*seq)),
                push_instruction: Some(PushInstruction::PushStart(SequenceValue {
                    value,
                    seq: Some(*seq),
                })),
                broadcast: None,
                subject_size: 0,
            },
            Action::Relay => ApplyResult {
                delete_instruction: None,
                push_instruction: None,
                broadcast: Some(SequenceValue { value, seq: None }),
                subject_size: 0,
            },
        };

        match &result.delete_instruction {
            Some(DeleteInstruction::Delete) => {
                let value_log = self.subjects.get_or_default(key);
                value_log.values.clear();
            }
            Some(DeleteInstruction::DeleteUpTo(seq)) => {
                let value_log = self.subjects.get_or_default(key);
                value_log.values.retain(|v| v.seq > Some(*seq));
            }
            None => {}
        }

        match &result.push_instruction {
            Some(PushInstruction::Push(value)) => {
                let value_log = self.subjects.get_or_default(key);
                value_log.values.push_back(value.clone());
            }
            Some(PushInstruction::PushStart(value)) => {
                let value_log = self.subjects.get_or_default(key);
                value_log.values.push_front(value.clone());
            }
            None => {}
        }

        result.subject_size = self.subjects.get(key).map(|v| v.values.len()).unwrap_or(0);

        result
    }
}
