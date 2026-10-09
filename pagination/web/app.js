import { fetchNaive, fetchOffset, fetchCursor, insertDemoMovie, resetDemoMovies } from "./api.js"
import { PAGE_SIZE } from "./config.js"

// --- Strategies -------------------------------------------------------------
//
//  Each strategy exposes: label and load(page) -> { data, bytes, ms }
//  where data is of the shape { items, count, total, hasMore, nextCursor }

// Client-side slicing, database returns a full collection scan
function naiveStrategy() {
  let all = null

  async function load(cursor) {
    const page = Number(cursor ?? 1)
    let bytes = 0
    let ms = 0
    if (!all) {
      const response = await fetchNaive()
      all = response.data.items
      bytes = response.bytes
      ms = response.ms
    }

    const start = (page - 1) * PAGE_SIZE
    const items = all.slice(start, start + PAGE_SIZE)
    const hasMore = start + PAGE_SIZE < all.length

    return {
      data: {
        items,
        count: items.length,
        total: all.length,
        hasMore,
        nextCursor: hasMore ? String(page + 1) : null
      },
      bytes,
      ms
    }
  }

  return {
    label: "Naive - fetch all, slice locally",
    load,
    reset: () => { all = null }
  }
}

// Offset - skip + limit
function offsetStrategy() {
  async function load(cursor) {
    const page = Number(cursor ?? 1)
    const result = await fetchOffset(page)
    result.data.nextCursor = result.data.hasMore ? String(page + 1) : null
    return result
  }

  return {
    label: "Offset - skip + limit",
    load,
    reset: () => {}
  }
}

// Cursor
function cursorStrategy() {
  return {
    label: "Cursor - range on _id",
    load: fetchCursor,
    reset: () => {}
  }
}

const strategies = {
  naive: naiveStrategy(),
  offset: offsetStrategy(),
  cursor: cursorStrategy()
}

// --- DOM --------------------------------------------------------------------

const elements = {
  dupes: document.querySelector("#dupes"),
  grid: document.querySelector("#grid"),
  indicator: document.querySelector("#page-indicator"),
  insert: document.querySelector("#insert"),
  metrics: document.querySelector("#metrics"),
  next: document.querySelector("#next"),
  prev: document.querySelector("#prev"),
  reset: document.querySelector("#reset"),
  status: document.querySelector("#status"),
  strategy: document.querySelector("#strategy"),
  template: document.querySelector("#card"),
}

const state = {
  key: "offset",
  history: [null],  // opaque cursors; index 0 = first page
  index: 0,
  data: {
    items: [],
    total: null,
    hasMore: false,
    nextCursor: null
  }
}

const seen = new Map()  // ids already rendered -- detects duplicates
let dupes = 0

// --- Rendering -------------------------------------------------------------

function formatBytes(bytes) {
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MB`
  }
  if (bytes >= 1_024) {
    return `${(bytes / 1_024).toFixed(1)} KB`
  }
  return `${bytes} B`
}

function renderCard(movie, depth) {
  const node = elements.template.content.cloneNode(true)
  const img = node.querySelector(".poster")
  img.src = movie.poster ?? ""
  img.alt = movie.title ?? ""
  node.querySelector(".title").textContent = movie.title ?? "Untitled"
  node.querySelector(".year").textContent = movie.year ?? ""

  const card = node.querySelector(".card")
  if (movie.demo) {
    const b = document.createElement("span")
    b.className = "badge"
    b.textContent = "new"
    card.append(b)
  }

  const firstSeen = seen.get(movie._id)
  if (firstSeen === undefined) {
    seen.set(movie._id, depth)
  } else if (firstSeen !== depth) {
    dupes += 1
    card.classList.add("duplicate")
  }

  return node
}

function render() {
  const { items, total, hasMore } = state.data
  dupes = 0

  elements.grid.replaceChildren(...items.map(item => renderCard(item, state.index)))
  
  const pages = total != null ? Math.ceil(total / PAGE_SIZE) : "?"

  elements.status.textContent = total != null ? `${total} movies` : `${state.data.count} movies` 
  elements.indicator.textContent = total != null ? `${state.index + 1} / ${pages}` : `${state.index + 1}`
  elements.prev.disabled = state.index === 0
  elements.next.disabled = !hasMore
  elements.dupes.textContent = dupes ? `⚠ ${dupes} duplicate(s)` : ""
}

// --- Navigation -------------------------------------------------------------

// Rapid switching between pages could render stale data if a slow earlier response
// lands after a newer one. Request token prevents this problem.
let requestToken = 0

async function loadAt(index) {
  const token = ++requestToken
  const cursor = state.history[index]
  if (index === 0) seen.clear()
  
  state.index = index
  elements.status.textContent = "Loading..."
  elements.prev.disabled = true
  elements.next.disabled = true

  try {
    const { data, bytes, ms } = await strategies[state.key].load(cursor)
    if (token !== requestToken) return
    state.data = data
    render()
    elements.metrics.textContent = `${formatBytes(bytes)} • ${ms.toFixed(0)} ms`
  } catch (err) {
    if (token !== requestToken) return
    elements.status.textContent = `Error: ${err.message}`
  }
}

function next() {
  const cursor = state.data.nextCursor
  if (!cursor) return

  state.history = state.history.slice(0, state.index + 1)    // drop any forward history
  state.history.push(cursor)
  loadAt(state.index + 1)
}

function prev() {
  if (state.index === 0) return
  loadAt(state.index - 1)
}

function restart() {
  state.history = [null]
  state.index = 0
  seen.clear()
  return loadAt(0)
}



// --- Interactivity ----------------------------------------------------------

elements.strategy.replaceChildren(
  ...Object.entries(strategies).map(([key, s]) => {
    const option = document.createElement("option")
    option.value = key
    option.textContent = s.label
    return option
  })
)
elements.strategy.value = state.key

elements.prev.addEventListener("click", prev)
elements.next.addEventListener("click", next)
elements.strategy.addEventListener("change", () => {
  state.key = elements.strategy.value
  restart()
})

elements.insert.addEventListener("click", async () => {
  const response = await insertDemoMovie()
  elements.metrics.textContent = `inserted "${response.title}" - now click Next`
})

elements.reset.addEventListener("click", async () => {
  const response = await resetDemoMovies()
  strategies[state.key].reset()
  await restart()
  elements.metrics.textContent = `removed ${response.deleted} demo movie(s)`
})

restart()