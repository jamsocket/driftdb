use crate::types::MessageFromDatabase;
use std::{
    collections::VecDeque,
    sync::{Arc, Mutex},
};

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
