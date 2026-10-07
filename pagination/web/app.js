import { fetchNaive, fetchOffset } from "./api.js"
import { PAGE_SIZE } from "./config.js"

// --- Strategies -------------------------------------------------------------
//
//  Each strategy exposes: label and load(page) -> { data, bytes, ms }
//  where data is of the shape { items, count, total, hasMore, nextCursor }

// Client-side slicing, database returns a full collection scan
function naiveStrategy() {
  let all = null

  async function load(page) {
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

    return {
      data: {
        items,
        count: items.length,
        total: all.length,
        hasMore: start + PAGE_SIZE < all.length,
        nextCursor: null
      },
      bytes,
      ms
    }
  }

  return {
    label: "Naive - fetch all, slice locally",
    load
  }
}

const strategies = {
  naive: naiveStrategy(),
  offset: {
    label: "Offset - skip + limit",
    load: page => fetchOffset(page)
  }
}

// --- DOM --------------------------------------------------------------------

const elements = {
  grid: document.querySelector("#grid"),
  indicator: document.querySelector("#page-indicator"),
  metrics: document.querySelector("#metrics"),
  next: document.querySelector("#next"),
  prev: document.querySelector("#prev"),
  status: document.querySelector("#status"),
  strategy: document.querySelector("#strategy"),
  template: document.querySelector("#card"),
}

const state = {
  key: "offset",
  page: 1,
  data: {
    items: [],
    total: null,
    hasMore: false
  }
}

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

function renderCard(movie) {
  const node = elements.template.content.cloneNode(true)
  const img = node.querySelector(".poster")
  img.src = movie.poster ?? ""
  img.alt = movie.title ?? ""
  node.querySelector(".title").textContent = movie.title ?? "Untitled"
  node.querySelector(".year").textContent = movie.year ?? ""
  return node
}

function render() {
  const { items, total, hasMore } = state.data
  elements.grid.replaceChildren(...items.map(renderCard))
  
  const pages = total != null ? Math.ceil(total / PAGE_SIZE) : "?"

  const start = (state.page - 1) * state.pageSize
  elements.status.textContent = total != null ? `${total} movie` : `${state.data.count} movies` 
  elements.indicator.textContent = `${state.page} / ${pages}`
  elements.prev.disabled = state.page <= 1
  elements.next.disable = !hasMore
}

// --- Navigation -------------------------------------------------------------

async function go(page) {
  if (page < 1) return
  state.page = page
  elements.status.textContent = "Loading..."

  try {
    const { data, bytes, ms } = await strategies[state.key].load(page)
    state.data = data
    render()
    elements.metrics.textContent = `${formatBytes(bytes)} • ${ms.toFixed(0)} ms`
  } catch (err) {
    elements.status.textContent = `Error: ${err.message}`
  }
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

elements.prev.addEventListener("click", () => go(state.page - 1))
elements.next.addEventListener("click", () => go(state.page + 1))
elements.strategy.addEventListener("change", () => {
  state.key = elements.strategy.value
  go(1)
})

go(1)
