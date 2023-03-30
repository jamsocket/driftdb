import { Api, DbConnection, uniqueClientId, SyncedWebRTCConnections } from 'driftdb'

export {}
;(async () => {
  const api = new Api('https://api.jamsocket.live/db/WLDweFEUscLaUO7siNKf/')
  const room = await api.getRoom('testing1')
  const conn = new DbConnection()
  conn.connect(room.socket_url)
  const rtcconn = new SyncedWebRTCConnections(conn, uniqueClientId(), 20)
  rtcconn.setOnMessage((_msg) => {})
  while (true) {
    rtcconn.send(JSON.stringify('testing'))
    await new Promise((res) => {
      setTimeout(() => {
        res(true)
      }, 100)
    })
  }
})()
