use self::subject::Subject;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub mod subject;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize, Default, PartialOrd, Ord)]
pub struct SequenceNumber(pub u64);

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum Action {
    Relay,

    /// Append to the stream.
    Append,

    /// Replace the entire stream.
    Replace,

    /// Replace the entire stream up to the given sequence number.
    /// If the stream has already been rolled up to an equal or greater
    /// sequence number, this is ignored.
    Compact { seq: SequenceNumber },
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum MessageToDatabase {
    Push {
        /// Key to push to.
        key: Subject,

        /// Value to push.
        value: Value,

        /// Describes the action that this should have on the state.
        action: Action,
    },
    Dump {
        /// Key prefix to subscribe to.
        prefix: Subject,
    },
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
pub struct SequenceValue {
    pub value: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seq: Option<SequenceNumber>,
}

#[derive(Debug, PartialEq, Eq, Clone, Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum MessageFromDatabase {
    Push {
        key: Subject,
        value: SequenceValue,
    },
    Init {
        prefix: Subject,
        data: Vec<(Subject, Vec<SequenceValue>)>,
    },
    Error {
        message: String,
    },
    SubjectSize {
        key: Subject,
        size: usize,
    }
}
