use driftdb::MessageFromDatabase;
use worker::{Result, WebSocket};

/// A raw WebSocket is not Send or Sync, but that doesn't matter because we are compiling
/// to WebAssembly, which is single-threaded, so we wrap it in a newtype struct which
/// implements Send and Sync.
#[derive(Clone)]
pub struct WrappedWebSocket {
    pub socket: WebSocket,
    use_cbor: bool,
}
unsafe impl Send for WrappedWebSocket {}
unsafe impl Sync for WrappedWebSocket {}

impl WrappedWebSocket {
    pub fn new(socket: WebSocket, use_cbor: bool) -> Self {
        WrappedWebSocket { socket, use_cbor }
    }

    pub fn send(&self, message: &MessageFromDatabase) -> Result<()> {
        if self.use_cbor {
            let mut buffer = Vec::new();
            ciborium::ser::into_writer(&message, &mut buffer).map_err(|_| {
                worker::Error::RustError("Error encoding message to CBOR.".to_string())
            })?;
            self.socket.send_with_bytes(&buffer)?;
        } else {
            let message = serde_json::to_string(message)?;
            self.socket.send_with_str(message)?;
        }

        Ok(())
    }
}
