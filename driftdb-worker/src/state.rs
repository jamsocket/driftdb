use driftdb::{
    types::{key_seq_pair::KeyAndSeq, SequenceNumber, SequenceValue},
    Key, Store, ValueLog,
};
use gloo_utils::format::JsValueSerdeExt;
use serde_json::Value;
use std::{collections::HashMap, str::FromStr};
use worker::{Result, State};

pub struct PersistedDb(pub State);
unsafe impl Send for PersistedDb {}
unsafe impl Sync for PersistedDb {}

#[cfg(all(not(target_arch = "wasm32"), not(debug_assertions)))]
compile_error!(
    "driftdb-worker should only be compiled to WebAssembly. Use driftdb-server for other targets."
);

impl PersistedDb {
    pub async fn load_store(&self) -> Result<Store> {
        let storage = self.0.storage();
        let mut subjects = HashMap::<Key, ValueLog>::new();
        let data = storage.list().await?;

        let mut max_seq = 0;

        for kv in data.entries() {
            let kv = kv?;
            let (key, value): (String, String) = JsValueSerdeExt::into_serde(&kv)?;
            let key_and_seq = KeyAndSeq::from_str(&key)?;
            max_seq = max_seq.max(key_and_seq.seq.0);
            let value: Value = serde_json::from_str(&value)?;

            subjects
                .entry(key_and_seq.key)
                .or_insert_with(ValueLog::default)
                .values
                .push_back(SequenceValue {
                    value,
                    seq: key_and_seq.seq,
                });
        }

        Ok(Store::new(subjects, SequenceNumber(max_seq)))
    }
}
