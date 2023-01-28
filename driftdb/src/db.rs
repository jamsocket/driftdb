use crate::{
    connection::Connection,
    store::Store,
    types::{MessageFromDatabase, MessageToDatabase, SequenceNumber},
};
use std::sync::{Arc, Mutex, Weak};

#[derive(Default)]
pub struct DatabaseInner {
    connections: Vec<Weak<Connection>>,
    debug_connections: Vec<Weak<Connection>>,
    store: Store,
}

impl DatabaseInner {
    pub fn send_message(&mut self, message: &MessageToDatabase) -> Option<MessageFromDatabase> {
        match message {
            MessageToDatabase::Push { key, value, action } => {
                let result = self.store.apply(key, value.clone(), action);

                if !self.debug_connections.is_empty() {
                    if result.mutates() {
                        let data = self.store.dump(SequenceNumber::default());

                        let message = MessageFromDatabase::Init { data };

                        self.debug_connections.retain(|conn| {
                            if let Some(conn) = conn.upgrade() {
                                (conn.callback)(&message);
                                true
                            } else {
                                false
                            }
                        });
                    } else if let Some(seq_value) = &result.broadcast {
                        let message = MessageFromDatabase::Push {
                            key: key.clone(),
                            value: seq_value.clone(),
                        };
                        self.debug_connections.retain(|conn| {
                            if let Some(conn) = conn.upgrade() {
                                (conn.callback)(&message);
                                true
                            } else {
                                false
                            }
                        });
                    }
                }

                if let Some(seq_value) = result.broadcast {
                    let message = MessageFromDatabase::Push {
                        key: key.clone(),
                        value: seq_value,
                    };
                    self.connections.retain(|conn| {
                        if let Some(conn) = conn.upgrade() {
                            (conn.callback)(&message);
                            true
                        } else {
                            false
                        }
                    });
                }

                if result.subject_size > 1 {
                    let message = MessageFromDatabase::StreamSize {
                        key: key.clone(),
                        size: result.subject_size,
                    };
                    return Some(message);
                }
            }
            MessageToDatabase::Dump { seq } => {
                let data = self.store.dump(*seq);

                return Some(MessageFromDatabase::Init { data });
            }
        }

        None
    }
}

#[derive(Default, Clone)]
pub struct Database {
    inner: Arc<Mutex<DatabaseInner>>,
}

impl Database {
    pub fn new() -> Database {
        Self::default()
    }

    pub fn send_message(&self, message: &MessageToDatabase) -> Option<MessageFromDatabase> {
        let mut db = self.inner.lock().unwrap();
        db.send_message(message)
    }

    pub fn connect<F>(&self, callback: F) -> Arc<Connection>
    where
        F: Fn(&MessageFromDatabase) + 'static + Send + Sync,
    {
        let conn = Arc::new(Connection::new(callback, self.inner.clone()));
        self.inner
            .lock()
            .unwrap()
            .connections
            .push(Arc::downgrade(&conn));
        conn
    }

    pub fn connect_debug<F>(&self, callback: F) -> Arc<Connection>
    where
        F: Fn(&MessageFromDatabase) + 'static + Send + Sync,
    {
        let conn = Arc::new(Connection::new(callback, self.inner.clone()));
        self.inner
            .lock()
            .unwrap()
            .debug_connections
            .push(Arc::downgrade(&conn));
        conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        tests::MessageStash,
        types::{Action, SequenceNumber, SequenceValue},
    };
    use serde_json::{json, Value};

    fn subscribe(conn: &Connection) {
        conn.send_message(&MessageToDatabase::Dump {
            seq: SequenceNumber::default(),
        })
        .unwrap();
    }

    fn push(conn: &Connection, key: &str, value: Value, action: Action) {
        conn.send_message(&MessageToDatabase::Push {
            key: key.into(),
            value,
            action,
        })
        .unwrap();
    }

    #[test]
    /// When a new key is accessed, it will be initialized with no values.
    fn test_initialize() {
        let db = Database::new();
        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn);

        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash.next()
        );
    }

    #[test]
    /// Test sending and receiving an ephemeral message on the same connection.
    fn test_ephemeral_message() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn);

        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "abc": "def" }), Action::Relay);

        // Relay messages do not increase sequence number.
        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "abc": "def" }),
                    seq: SequenceNumber(2),
                }
            }),
            stash.next()
        );
    }

    #[test]
    fn test_ephemeral_message_multiple_connections() {
        let db = Database::new();

        let (stash1, callback1) = MessageStash::new();
        let conn1 = db.connect(callback1);
        subscribe(&conn1);
        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash1.next()
        );

        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);
        subscribe(&conn2);
        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash2.next()
        );

        push(&conn1, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash1.next()
        );

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_durable_message_sent_to_later_connection() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn);

        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Replace);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash.next()
        );

        // The durable message should be sent to new subscriptions.
        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);

        subscribe(&conn2);

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![(
                    "foo".into(),
                    vec![SequenceValue {
                        value: json!({ "bar": "baz" }),
                        seq: SequenceNumber(1),
                    }]
                )],
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_ephemeral_message_not_subscribed() {
        let db = Database::new();

        let (stash1, callback1) = MessageStash::new();
        let conn1 = db.connect(callback1);
        subscribe(&conn1);
        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash1.next()
        );

        let (stash2, _) = MessageStash::new();

        push(&conn1, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash1.next()
        );

        // Connection 2 is not subscribed.
        assert_eq!(None, stash2.next());
    }

    #[test]
    fn test_append() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn);

        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Append);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "bar": "baz" }),
                    seq: SequenceNumber(1),
                }
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "abc": "def" }), Action::Append);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "abc": "def" }),
                    seq: SequenceNumber(2),
                }
            }),
            stash.next()
        );
        assert_eq!(
            Some(MessageFromDatabase::StreamSize {
                key: "foo".into(),
                size: 2,
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "boo": "baa" }), Action::Append);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: SequenceValue {
                    value: json!({ "boo": "baa" }),
                    seq: SequenceNumber(3),
                }
            }),
            stash.next()
        );
        assert_eq!(
            Some(MessageFromDatabase::StreamSize {
                key: "foo".into(),
                size: 3,
            }),
            stash.next()
        );

        // The durable message should be sent to new subscriptions.
        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);

        subscribe(&conn2);

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![(
                    "foo".into(),
                    vec![
                        SequenceValue {
                            value: json!({ "bar": "baz" }),
                            seq: SequenceNumber(1),
                        },
                        SequenceValue {
                            value: json!({ "abc": "def" }),
                            seq: SequenceNumber(2),
                        },
                        SequenceValue {
                            value: json!({ "boo": "baa" }),
                            seq: SequenceNumber(3),
                        }
                    ]
                )],
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_compact() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn);

        assert_eq!(
            Some(MessageFromDatabase::Init { data: vec![] }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Append);
        push(&conn, "foo", json!({ "abc": "def" }), Action::Append);
        push(&conn, "foo", json!({ "boo": "baa" }), Action::Append);
        push(
            &conn,
            "foo",
            json!({ "moo": "ram" }),
            Action::Compact {
                seq: SequenceNumber(2),
            },
        );

        // The durable message should be sent to new subscriptions.
        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);

        subscribe(&conn2);

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![(
                    "foo".into(),
                    vec![
                        SequenceValue {
                            value: json!({ "moo": "ram" }),
                            seq: SequenceNumber(2),
                        },
                        SequenceValue {
                            value: json!({ "boo": "baa" }),
                            seq: SequenceNumber(3),
                        }
                    ]
                )],
            }),
            stash2.next()
        );
    }
}
