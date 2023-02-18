use std::collections::HashMap;
use driftdb::{Store, Key, ValueLog};
use gloo_utils::format::JsValueSerdeExt;
use serde_json::Value;
use worker::{State, Result};

pub struct PersistedDb(pub State);
unsafe impl Send for PersistedDb {}
unsafe impl Sync for PersistedDb {}

#[cfg(all(not(target_arch = "wasm32"), not(debug_assertions)))]
compile_error!(
    "driftdb-worker should only be compiled to WebAssembly. Use driftdb-server for other targets."
);

impl PersistedDb {
    fn new(state: State) -> Self {
        Self(state)
    }

    pub async fn load_store(&self) -> Result<Store> {
        let storage = self.0.storage();
        let subjects = HashMap::<Key, ValueLog>::new();

        let data = storage.list().await?;

        for kv in data.entries() {
            let kv = kv?;
            let (key, value): (Key, Value) = JsValueSerdeExt::into_serde(&kv)?;


            // let value = storage.get(&key).await?;
            // let value = String::from_utf8(value)?;
            // let key_and_seq = KeyAndSeq::from_str(&key)?;
            // let value = Value::from_str(&value)?;

            // subjects
            //     .entry(key_and_seq.key)
            //     .or_insert_with(ValueLog::new)
            //     .values
            //     .push(SequenceValue { value, seq: key_and_seq.seq });
        }


        todo!()
    }
}