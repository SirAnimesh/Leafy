import { PAGE_SIZE } from "./config.js"

async function get(path) {
  const started = performance.now()
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return {
    data,
    bytes: Number(res.headers.get("content-length")) || 0,
    ms: performance.now() - started
  }
}

export const fetchNaive = () => get("/api/movies/naive")
export const fetchOffset = page => get(`/api/movies/offset?page=${page}&limit=${PAGE_SIZE}`)
export const insertDemoMovie = () => fetch("/api/movies/insert", { method: "POST" }).then(r => r.json())
export const resetDemoMovies = () => fetch("/api/movies/reset", { method: "POST" }).then(r => r.json())
