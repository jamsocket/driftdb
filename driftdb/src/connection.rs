use crate::{
    db::DatabaseInner,
    types::{MessageFromDatabase, MessageToDatabase},
};
use std::sync::{Arc, Mutex, Weak};

pub struct Connection {
    pub callback: Arc<Box<dyn Fn(&MessageFromDatabase) + Send + Sync>>,
    database: Weak<Mutex<DatabaseInner>>,
}

impl Connection {
    pub fn new<F>(callback: F, database: Arc<Mutex<DatabaseInner>>) -> Connection
    where
        F: Fn(&MessageFromDatabase) + 'static + Send + Sync,
    {
        Connection {
            callback: Arc::new(Box::new(callback)),
            database: Arc::downgrade(&database),
        }
    }

    pub fn send_message(&self, message: &MessageToDatabase) -> Result<(), &str> {
        if let Some(response) = self
            .database
            .upgrade()
            .unwrap()
            .lock()
            .unwrap()
            .send_message(message)
        {
            (self.callback)(&response);
        };

        Ok(())
    }
}
