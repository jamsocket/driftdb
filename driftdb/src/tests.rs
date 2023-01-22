use chrono::TimeZone;
use chrono::{DateTime, Utc};
use serde_json::json;
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

use crate::types::subject::Subject;
use crate::types::MessageFromDatabase;

pub fn subject(subject: &str) -> Subject {
    serde_json::from_value(json!(subject)).unwrap()
}

pub fn timestamp(milis: i64) -> DateTime<Utc> {
    Utc.timestamp_millis_opt(milis).unwrap()
}

pub struct MessageStash {
    messages: Arc<Mutex<VecDeque<MessageFromDatabase>>>,
}

impl MessageStash {
    pub fn new() -> (MessageStash, impl Fn(&MessageFromDatabase)) {
        let stash = MessageStash {
            messages: Arc::new(Mutex::new(VecDeque::new())),
        };

        let callback = {
            let messages = stash.messages.clone();
            move |message: &MessageFromDatabase| {
                messages.lock().unwrap().push_back(message.clone());
            }
        };

        (stash, callback)
    }

    pub fn next(&self) -> Option<MessageFromDatabase> {
        self.messages.lock().unwrap().pop_front()
    }
}
