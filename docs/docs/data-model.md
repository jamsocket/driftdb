---
sidebar_position: 2
---

# Data Model

DriftDB’s underlying data model is like a key-value store, except that each value is a list. When clients send messages, they include an **action**, which instructs the server how to mutate the data in the list, and whether to forward the message payload to other connected clients.

- The **`replace`** action replaces the entire list with a single-element list containing the message’s payload, and sends it to connected clients. This results in behavior that resembles a **key/value store**.
- The **`relay`** action does not modify the list at all, but sends it to connected clients. This behavior resembels **traditional pub/sub**.
- The **`append`** action appends the value to the list, and sends it to connected clients. This behavior resembles a **durable stream**.
- The **`compact`** action takes a **sequence number**, and replaces every element in the list *up to and including* that sequence number with the provided value. It does *not* send the message to connected clients. This behavior resembles **log compaction**.


