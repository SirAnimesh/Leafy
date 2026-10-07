import http from "node:http"
import { MongoClient } from "mongodb"

const { MONGODB_URI, MONGODB_DB = "leafy", PORT = 3000 } = process.env

const client = new MongoClient(MONGODB_URI)
await client.connect()
const db = client.db(MONGODB_DB)
console.info(`Connected to MongoDB -> db "${MONGODB_DB}"`)

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  if (url.pathname === "/api/health") {
    await db.command({ ping: 1 })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.writeHead(404, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ error: "Not found" }))
})

server.listen(PORT, () => console.info(`Listening on http://localhost:${PORT}`))
