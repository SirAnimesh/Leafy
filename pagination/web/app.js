import { fetchNaive } from "./api.js"

const PAGE_SIZE = 24

const elements = {
  grid: document.querySelector("#grid"),
  template: document.querySelector("#card"),
  status: document.querySelector("#status"),
  metrics: document.querySelector("#metrics"),
  prev: document.querySelector("#prev"),
  next: document.querySelector("#next"),
  indicator: document.querySelector("#page-indicator")
}

const state = {
  items: [],
  page: 1,
  pageSize: PAGE_SIZE
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

function totalPages() {
  return Math.max(1, Math.ceil(state.items.length / state.pageSize))
}

function render() {
  const pages = totalPages()
  const start = (state.page - 1) * state.pageSize
  const slice = state.items.slice(start, start + state.pageSize)

  elements.grid.replaceChildren(...slice.map(renderCard))
  elements.status.textContent = `${state.items.length} movies in memory`
  elements.indicator.textContent = `${state.page} / ${pages}`
  elements.prev.disabled = state.page === 1
  elements.next.disable = state.page >= pages
}

elements.prev.addEventListener("click", () => {
  if (state.page > 1) {
    state.page -= 1
    render()
  }
})

elements.next.addEventListener("click", () => {
  if (state.page < totalPages()) {
    state.page += 1
    render()
  }
})

async function init() {
  const { data, bytes, ms } = await fetchNaive()
  state.items = data.items
  render()
  elements.metrics.textContent = `${(bytes / (1024 * 1024)).toFixed(2)} MB • ${ms.toFixed(0)} ms • 1 request`
}

init()
