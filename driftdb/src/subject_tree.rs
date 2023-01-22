use crate::types::subject::Subject;
use std::collections::HashMap;

#[derive(Debug, Default)]
pub struct SubjectTreeNode<T: Default> {
    value: T,
    children: HashMap<String, SubjectTreeNode<T>>,
}

impl<T: Default> SubjectTreeNode<T> {
    fn new() -> Self {
        Self {
            value: T::default(),
            children: HashMap::new(),
        }
    }

    fn locate(&self, subject: &[String]) -> Option<&Self> {
        if subject.is_empty() {
            Some(self)
        } else {
            self.children
                .get(&subject[0])
                .and_then(|child| child.locate(&subject[1..]))
        }
    }

    fn locate_mut(&mut self, subject: &[String]) -> &mut Self {
        if subject.is_empty() {
            self
        } else {
            let child = self
                .children
                .entry(subject[0].clone())
                .or_insert_with(SubjectTreeNode::new);
            child.locate_mut(&subject[1..])
        }
    }
}

impl<T> SubjectTreeNode<Option<T>> {
    pub fn gather_with_subject<'a>(&'a self, subject: Subject, result: &mut Vec<(Subject, &'a T)>) {
        if let Some(value) = &self.value {
            result.push((subject.clone(), value));
        }
        for (key, child) in &self.children {
            let mut child_subject = subject.clone();
            child_subject.0.push(key.clone());
            child.gather_with_subject(child_subject, result);
        }
    }
}

impl<T> SubjectTreeNode<Vec<T>> {
    #[allow(unused)]
    fn gather<'a>(&'a self, result: &mut Vec<&'a T>) {
        result.extend(self.value.iter());
        for child in self.children.values() {
            child.gather(result);
        }
    }
}

#[derive(Debug, Default)]
pub struct SubjectTree<T: Default> {
    root: SubjectTreeNode<T>,
}

impl<T: Default> SubjectTree<T> {
    #[allow(unused)]
    pub fn new() -> Self {
        Self {
            root: SubjectTreeNode::new(),
        }
    }
}

impl<TT: Default> SubjectTree<Option<TT>> {
    #[allow(unused)]
    pub fn set(&mut self, subject: &Subject, value: TT) {
        let mut node = self.root.locate_mut(&subject.0);
        node.value = Some(value);
    }

    #[allow(unused)]
    pub fn get(&self, subject: &Subject) -> Option<&TT> {
        let node = &self.root.locate(&subject.0)?;
        node.value.as_ref()
    }

    pub fn get_or_default(&mut self, subject: &Subject) -> &mut TT {
        let node = self.root.locate_mut(&subject.0);
        node.value.get_or_insert_with(TT::default)
    }

    pub fn gather_with_subject(&self, subject: &Subject) -> Vec<(Subject, &TT)> {
        let mut result = Vec::new();
        if let Some(node) = self.root.locate(&subject.0) {
            node.gather_with_subject(subject.clone(), &mut result);
        }
        result
    }
}

impl<TT> SubjectTree<Vec<TT>> {
    #[allow(unused)]
    pub fn push(&mut self, subject: &Subject, value: TT) {
        let node = self.root.locate_mut(&subject.0);
        node.value.push(value);
    }

    /// Returns a list of values that are a prefix of the given subject.
    #[allow(unused)]
    pub fn gather_prefix(&self, subject: &Subject) -> Vec<&TT> {
        let mut result = Vec::new();
        let mut node = &self.root;
        result.extend(node.value.iter());
        for part in &subject.0 {
            if let Some(child) = node.children.get(part) {
                node = child;
                result.extend(node.value.iter());
            } else {
                break;
            }
        }
        result
    }

    /// Returns a list of values that have the given subject as a prefix.
    #[allow(unused)]
    pub fn gather(&self, subject: &Subject) -> Vec<&TT> {
        let mut result = Vec::new();
        if let Some(node) = self.root.locate(&subject.0) {
            node.gather(&mut result);
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests::subject;

    #[test]
    fn test_no_subscriptions() {
        let tree = SubjectTree::<Vec<usize>>::new();
        let subscriptions = tree.gather_prefix(&subject(""));
        assert_eq!(subscriptions.len(), 0);
    }

    #[test]
    fn test_exact_subscription() {
        let mut tree = SubjectTree::<Vec<usize>>::new();
        let sub = subject("a");
        tree.push(&sub, 0);
        let subscriptions = tree.gather_prefix(&sub);
        assert_eq!(vec![&0], subscriptions);
    }

    #[test]
    fn test_wildcard_subscription() {
        let mut tree = SubjectTree::<Vec<usize>>::new();
        tree.push(&subject("a"), 0);
        let subscriptions = tree.gather_prefix(&subject("a.b"));
        assert_eq!(vec![&0], subscriptions);
    }

    #[test]
    fn test_wildcard_subscription_levels() {
        let mut tree = SubjectTree::<Vec<usize>>::new();
        tree.push(&subject("a"), 0);
        tree.push(&subject("a.b"), 1);
        tree.push(&subject("a.b.c"), 2);
        tree.push(&subject(""), 3);
        tree.push(&subject("a.b.c.d"), 4);
        let subscriptions = tree.gather_prefix(&subject("a.b.c"));
        assert_eq!(vec![&3, &0, &1, &2], subscriptions);
    }
}
