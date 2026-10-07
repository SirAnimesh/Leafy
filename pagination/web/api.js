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
