use serde::{Deserialize, Serialize};

#[derive(Debug, PartialEq, Eq, Clone, Serialize, Default)]
pub struct Subject(pub Vec<String>);

#[derive(Deserialize)]
#[serde(untagged)]
enum DeserializeSubject {
    String(String),
    Array(Vec<String>),
}

impl<'de> Deserialize<'de> for Subject {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let subject = DeserializeSubject::deserialize(deserializer)?;

        let subject = match subject {
            DeserializeSubject::String(s) if s.is_empty() => vec![],
            DeserializeSubject::String(s) => s.split('.').map(|s| s.to_string()).collect(),
            DeserializeSubject::Array(a) => a,
        };

        Ok(Subject(subject))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_deserialize_subject_string() {
        let subject = json!("a.b.c");
        let subject: Subject = serde_json::from_value(subject).unwrap();
        assert_eq!(&subject.0, &["a", "b", "c"]);
    }

    #[test]
    fn test_deserialize_subject_list() {
        let subject = json!(["a", "b", "c"]);
        let subject: Subject = serde_json::from_value(subject).unwrap();
        assert_eq!(&subject.0, &["a", "b", "c"]);
    }

    #[test]
    fn test_deserialize_subject_list_containing_dots() {
        let subject = json!(["a", "b", "c", "d.e.f"]);
        let subject: Subject = serde_json::from_value(subject).unwrap();
        assert_eq!(&subject.0, &["a", "b", "c", "d.e.f"]);
    }

    #[test]
    fn test_deserialize_empty_string() {
        let subject = json!("");
        let subject: Subject = serde_json::from_value(subject).unwrap();
        assert!(&subject.0.is_empty());
    }
}
