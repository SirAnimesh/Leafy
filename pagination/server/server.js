import http from "node:http"
import { readFile } from "node:fs/promises"
import { extname, join } from "node:path"
import { fileURLToPath } from "node:url" 
import { MongoClient } from "mongodb"
import { PAGE_SIZE } from "../web/config.js"

const { MONGODB_URI, MONGODB_DB = "leafy", PORT = 3000 } = process.env

const WEB_DIR = fileURLToPath(new URL("../web/", import.meta.url))
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
}

const client = new MongoClient(MONGODB_URI)
await client.connect()
const db = client.db(MONGODB_DB)
const movies = client.db("sample_mflix").collection("movies")
const MOVIE_LIST_PROJECTION = { title: 1, year: 1, poster: 1, genres: 1, demo: 1 }

// --- Helpers ----------------------------------------------------------------

const json = (res, status, body) => {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload)
  })
  res.end(payload)
}

const paginate = (items, { total = null, hasMore = false, nextCursor = null } = {}) => ({
  items,
  count: items.length,
  total,
  hasMore,
  nextCursor
})

// --- Route Handlers ---------------------------------------------------------

async function getHealth(req, res) {
  await db.command({ ping: 1 })
  return json(res, 200, { ok: true }) 
}

async function getMoviesNaive(req, res) {
  const items = await movies
    .find({}, { projection: MOVIE_LIST_PROJECTION })
    .toArray()
  return json(res, 200, paginate(items, { total: items.length }))
}

async function getMoviesOffset(req, res, url) {
  const pageNum = Math.max(1, Number(url.searchParams.get("page") ?? 1))

  // Limit = give me these many documents
  const MAX_LIMIT = 100
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get("limit") ?? PAGE_SIZE)))
  // Skip = ignore this many from the top
  // Database server still has to walk every skipped document so skipping isn't free!
  const skip = (pageNum - 1) * limit

  const [items, total] = await Promise.all([
    movies
      .find({}, { projection: MOVIE_LIST_PROJECTION })
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    movies.countDocuments({})
  ])

  return json(res, 200, paginate(items, { total, hasMore: skip + items.length < total }))
}

async function insertDemoMovie(req, res) {
  const doc = {
    title: `Demo Movie ${new Date().toISOString()}`,
    year: new Date().getFullYear(),
    genres: ["Demo"],
    demo: true,
    createdAt: new Date()
  }

  const { insertedId } = await movies.insertOne(doc)
  return json(res, 201, { id: insertedId, title: doc.title })
}

async function resetDemoMovies(req, res) {
  const { deletedCount } = await movies.deleteMany({ demo: true })
  return json(res, 200, { deleted: deletedCount })
}

// --- Routing ----------------------------------------------------------------

const routes = {
  "GET /api/health": getHealth,
  "GET /api/movies/naive": getMoviesNaive,
  "GET /api/movies/offset": getMoviesOffset,
  "POST /api/movies/insert": insertDemoMovie,
  "POST /api/movies/reset": resetDemoMovies
}

async function serveStatic(res, pathname) {
  const file = join(WEB_DIR, pathname)
  if (!file.startsWith(WEB_DIR)) return json(res, 403, { error: "Forbidden" })

  const data = await readFile(file)
  res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" })
  res.end(data)
}

// --- Server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  try {
    const handler = routes[`${req.method} ${url.pathname}`]
    if (handler) return await handler(req, res, url)

    await serveStatic(res, url.pathname === "/" ? "/index.html" : url.pathname)
  } catch (err) {
    if (err.code === "ENOENT") return json(res, 404, { error: "Not found" })
    console.error(err)
    json(res, 500, { error: "Internal Server Error" })
  }
})

server.listen(PORT, () => console.info(`Listening on http://localhost:${PORT}`))
