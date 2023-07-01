use crate::{
    db::DatabaseInner,
    types::{MessageFromDatabase, MessageToDatabase},
};
use std::sync::{Arc, Mutex, Weak};

type Callback = Arc<Box<dyn Fn(&MessageFromDatabase) + Send + Sync>>;

pub struct Connection {
    pub callback: Callback,
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

    pub fn send_message(
        self: &Arc<Self>,
        message: &MessageToDatabase,
    ) -> Result<Option<MessageFromDatabase>, &str> {
        let db_lock = self.database.upgrade().ok_or("Database is gone")?;
        let mut database = db_lock.lock().unwrap();

        let result = match message {
            MessageToDatabase::Push { key, value, action } => database.push(key, value, action),
            MessageToDatabase::Get { seq, key } => {
                database.subscribe(key, Arc::downgrade(self));
                if let Some(seq) = seq {
                    // Send prior events on the stream if sequence number is provided.
                    database.get(key, *seq)
                } else {
                    None
                }
            }
            MessageToDatabase::Ping { nonce } => Some(MessageFromDatabase::Pong { nonce: *nonce }),
        };

        if let Some(response) = result.clone() {
            (self.callback)(&response);
        };

        Ok(result)
    }
}
