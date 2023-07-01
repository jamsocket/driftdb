use crate::{
    connection::Connection,
    store::{ApplyResult, Store},
    types::{Action, MessageFromDatabase, SequenceNumber},
    Key,
};
use ciborium::Value;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, Weak},
};

type ReplicaCallback = Arc<Box<dyn Fn(&ApplyResult) + Send + Sync>>;

#[derive(Default)]
pub struct DatabaseInner {
    subscriptions: HashMap<Key, Vec<Weak<Connection>>>,
    debug_connections: Vec<Weak<Connection>>,
    replica_callback: Option<ReplicaCallback>,
    store: Store,
}

impl DatabaseInner {
    pub fn push(
        &mut self,
        key: &Key,
        value: &Value,
        action: &Action,
    ) -> Option<MessageFromDatabase> {
        let result = self.store.apply(key, value.clone(), action);

        if !self.debug_connections.is_empty() {
            if result.mutates() {
                let data = self.store.get(key, SequenceNumber::default());

                let message = MessageFromDatabase::Init {
                    data,
                    key: key.clone(),
                };

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
                    value: seq_value.value.clone(),
                    seq: seq_value.seq,
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

        if result.mutates() {
            if let Some(replica_callback) = &self.replica_callback {
                (replica_callback)(&result);
            }
        }

        if let Some(seq_value) = result.broadcast {
            let message = MessageFromDatabase::Push {
                key: key.clone(),
                value: seq_value.value.clone(),
                seq: seq_value.seq,
            };

            if let Some(listeners) = self.subscriptions.get_mut(key) {
                listeners.retain(|conn| {
                    if let Some(conn) = conn.upgrade() {
                        (conn.callback)(&message);
                        true
                    } else {
                        false
                    }
                });
            }
        }

        if result.stream_size > 1 {
            let message = MessageFromDatabase::StreamSize {
                key: key.clone(),
                size: result.stream_size,
            };
            return Some(message);
        }

        None
    }

    pub fn subscribe(&mut self, key: &Key, connection: Weak<Connection>) {
        let listeners = self.subscriptions.entry(key.clone()).or_default();
        listeners.push(connection);
    }

    pub fn get(&self, key: &Key, seq: SequenceNumber) -> Option<MessageFromDatabase> {
        let data = self.store.get(key, seq);

        Some(MessageFromDatabase::Init {
            data,
            key: key.clone(),
        })
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

    pub fn new_from_store(store: Store) -> Database {
        Database {
            inner: Arc::new(Mutex::new(DatabaseInner {
                store,
                ..Default::default()
            })),
        }
    }

    pub fn set_replica_callback<F>(&mut self, callback: F)
    where
        F: Fn(&ApplyResult) + 'static + Send + Sync,
    {
        self.inner.lock().unwrap().replica_callback = Some(Arc::new(Box::new(callback)));
    }

    pub fn connect<F>(&self, callback: F) -> Arc<Connection>
    where
        F: Fn(&MessageFromDatabase) + 'static + Send + Sync,
    {
        Arc::new(Connection::new(callback, self.inner.clone()))
    }

    pub fn connect_debug<F>(&self, callback: F) -> Arc<Connection>
    where
        F: Fn(&MessageFromDatabase) + 'static + Send + Sync,
    {
        let conn = Arc::new(Connection::new(callback, self.inner.clone()));

        let mut db = self.inner.lock().unwrap();

        for (key, values) in db.store.dump() {
            let message = MessageFromDatabase::Init { data: values, key };
            (conn.callback)(&message);
        }

        db.debug_connections.push(Arc::downgrade(&conn));
        conn
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        tests::MessageStash,
        types::{Action, SequenceNumber, SequenceValue},
        MessageToDatabase,
    };
    use serde_json::json;

    fn json_to_cbor(value: serde_json::Value) -> ciborium::value::Value {
        ciborium::Value::serialized(&value).unwrap()
    }

    fn subscribe(conn: &Arc<Connection>, key: &str) {
        conn.send_message(&MessageToDatabase::Get {
            seq: Some(SequenceNumber::default()),
            key: key.into(),
        })
        .unwrap();
    }

    fn push(conn: &Arc<Connection>, key: &str, value: serde_json::Value, action: Action) {
        conn.send_message(&MessageToDatabase::Push {
            key: key.into(),
            value: json_to_cbor(value),
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

        subscribe(&conn, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash.next()
        );
    }

    #[test]
    /// Relay messages are not sent to a receiver unless it has subscribed.
    fn test_subscribe_relay() {
        let db = Database::new();
        let (stash, callback) = MessageStash::new();
        let conn1 = db.connect(callback);
        let conn2 = db.connect(|_| ());

        push(&conn2, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert!(
            stash.next().is_none(),
            "conn1 should not receive message because it has not subscribed"
        );

        subscribe(&conn1, "foo");
        push(&conn2, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Init {
                key: "foo".into(),
                data: vec![],
            }),
            stash.next()
        );
        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(2),
            }),
            stash.next()
        );
    }

    #[test]
    /// Test sending and receiving an ephemeral message on the same connection.
    fn test_ephemeral_message() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "abc": "def" }), Action::Relay);

        // Relay messages do not increase sequence number.
        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "abc": "def" })),
                seq: SequenceNumber(2),
            }),
            stash.next()
        );
    }

    #[test]
    fn test_ephemeral_message_multiple_connections() {
        let db = Database::new();

        let (stash1, callback1) = MessageStash::new();
        let conn1 = db.connect(callback1);
        subscribe(&conn1, "foo");
        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash1.next()
        );

        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);
        subscribe(&conn2, "foo");
        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash2.next()
        );

        push(&conn1, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
            }),
            stash1.next()
        );

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_durable_message_sent_to_later_connection() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Replace);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
            }),
            stash.next()
        );

        // The durable message should be sent to new subscriptions.
        let (stash2, callback2) = MessageStash::new();
        let conn2 = db.connect(callback2);

        subscribe(&conn2, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![SequenceValue {
                    value: json_to_cbor(json!({ "bar": "baz" })),
                    seq: SequenceNumber(1),
                }],
                key: "foo".into()
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_ephemeral_message_not_subscribed() {
        let db = Database::new();

        let (stash1, callback1) = MessageStash::new();
        let conn1 = db.connect(callback1);
        subscribe(&conn1, "foo");
        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash1.next()
        );

        let (stash2, _) = MessageStash::new();

        push(&conn1, "foo", json!({ "bar": "baz" }), Action::Relay);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
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

        subscribe(&conn, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "bar": "baz" }), Action::Append);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "bar": "baz" })),
                seq: SequenceNumber(1),
            }),
            stash.next()
        );

        push(&conn, "foo", json!({ "abc": "def" }), Action::Append);

        assert_eq!(
            Some(MessageFromDatabase::Push {
                key: "foo".into(),
                value: json_to_cbor(json!({ "abc": "def" })),
                seq: SequenceNumber(2),
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
                value: json_to_cbor(json!({ "boo": "baa" })),
                seq: SequenceNumber(3),
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

        subscribe(&conn2, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                key: "foo".into(),
                data: vec![
                    SequenceValue {
                        value: json_to_cbor(json!({ "bar": "baz" })),
                        seq: SequenceNumber(1),
                    },
                    SequenceValue {
                        value: json_to_cbor(json!({ "abc": "def" })),
                        seq: SequenceNumber(2),
                    },
                    SequenceValue {
                        value: json_to_cbor(json!({ "boo": "baa" })),
                        seq: SequenceNumber(3),
                    }
                ]
            }),
            stash2.next()
        );
    }

    #[test]
    fn test_compact() {
        let db = Database::new();

        let (stash, callback) = MessageStash::new();
        let conn = db.connect(callback);

        subscribe(&conn, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                data: vec![],
                key: "foo".into()
            }),
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

        subscribe(&conn2, "foo");

        assert_eq!(
            Some(MessageFromDatabase::Init {
                key: "foo".into(),
                data: vec![
                    SequenceValue {
                        value: json_to_cbor(json!({ "moo": "ram" })),
                        seq: SequenceNumber(2),
                    },
                    SequenceValue {
                        value: json_to_cbor(json!({ "boo": "baa" })),
                        seq: SequenceNumber(3),
                    }
                ]
            }),
            stash2.next()
        );
    }
}
