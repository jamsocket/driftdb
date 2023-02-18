use std::str::FromStr;
use crate::Key;

/// A key and sequence number pair which can be serialized to and from
/// a string. This is meant to be used as a key in a key-value store
/// where keys are sorted lexicographically. Desired properties are:
/// - KeyAndSeq values with the same key should all have the same prefix.
/// - KeyAndSeq values with the same key should be sorted by sequence number.
#[derive(Debug, PartialEq, Eq, Clone, Hash)]
struct KeyAndSeq {
    key: Key,
    seq: u64,
}

impl ToString for KeyAndSeq {
    fn to_string(&self) -> String {
        format!("{}|{}|{:020}", self.key.len(), self.key, self.seq)
    }
}

impl FromStr for KeyAndSeq {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, &'static str> {
        let (key_len, rest) = s.split_at(s.find('|').unwrap());
        let key_len = key_len.parse::<usize>().unwrap();
        let (key, rest) = rest.split_at(key_len + 1);
        let key = Key::new(key[1..].to_string());
        let seq = rest[1..].parse::<u64>().unwrap();
        Ok(Self { key, seq })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_and_seq() {
        let k = KeyAndSeq {
            key: Key::new("foo".to_string()),
            seq: 123,
        };
        let s = k.to_string();
        assert_eq!(s, "3|foo|00000000000000000123");
        let k2 = KeyAndSeq::from_str(&s).unwrap();
        assert_eq!(k, k2);
    }
}
