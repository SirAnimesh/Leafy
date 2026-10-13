# Pagination

A showcase of pagination strategies against a live MongoDB Atlas cluster, from the most naive approach to infinite scroll.
Every strategy is exposed side by side so they can be compared in the browser.

## Try it yourself

1. Create `server/.env` and set `MONGODB_URI`, `MONGODB_DB` and application `PORT`. See `server/.env.example`.
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

Use two dropdowns in the header:

- **Strategy**: `Naive` • `Offset` • `Cursor`
- **View**: `Paged` • `Infinite Scroll`

Plus two buttons:

- `+ Insert movie` to add a demo doc to the top of the collection
- `Reset Demo` to delete all demo docs and reset

Watch the readout in the header: bytes, latency, and request count per load (cumulative in infinite view)

### Experiments

1. **Naive**
  - Strategy = naive
  - multi-MB load first, then `0 B` on every page turn thereafter
  - whole collection lives in memory
  - now **Insert Movie** and page forward, nothing new appears
  - this strategy is stale by design

2. **Offset at depth**
  - Strategy = offset, View = paged
  - use `Next` a lot to get into deeper pages
  - watch latency climb with each subsequent page

3. **Offset breaks under concurrent writes**
  - Strategy = offset, View = Paged
  - On page 1, click **+ Insert Movie** and don't reload, then **Next**
  - The boundary card will show a read outline `duplicate(s)` warning appears in the header
  - A movie that you already saw on page one, has been served again on page 2

4. **Cursor stays stable under writes**
  - Strategy = Cursor, View = Paged
  - Reset demo then repeat experiment 3 above
  - No duplicates this time, the windows is anchored to a value `_id` instead of a position

5. **Infinite scroll**
  - View = infinite scroll
  - With `Cursor` strategy, it just flows, steady KB per batch, flat latency
  - With `Offset` strategy, insert a few films, then scroll down a little and you'll see duplicates

## Strategies

### 1. Naive: fetch all, slice in the browser

The server does a full collection scan and ships **all** documents. The browser holds the whole array and slices it into
pages.

- **Pros**
  - dead simple
  - page turns after the first are instant (no network)
- **Cons**
  - huge payload (multi-MB) and latency on first load
  - the entire dataset lives in client memory
  - **stale**: new writes are never seen until a reload.

### 2. Offset: `skip` + `limit`

```js
find({}).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit)
```

- **Pros**
  - small payload per request (~KB)
  - random access: can jump straight to page N
  - `total` is cheap to expose for a page count
- **Cons**
  - two distinct failure modes
  - Both **slow at depth** and **wrong under concurrent writes**

#### 2a. `skip` is O(n)

The server still *walks* every skipped document internally. Page 1 is instant; page 900 does 20,000+ steps to return 24 
rows.

```sh
node --env-file=.env server/explain.js
# skip     0 → keysExamined=24     returned=24
# skip 20000 → keysExamined=20024  returned=24
# cursor @20k → keysExamined=24    returned=24
```

`returned` is flat; `keysExamined` grows linearly with `skip`.

#### 2b. Unstable under writes

`skip` paginates by **position**, and positions move:

- Load page 1 (docs 1–24).
- Someone inserts a new doc at the top.
- Click Next → `skip: 24` → everything shifted down one, so doc #24 reappears (duplicate) and the last doc of the window
  is pushed out (skipped).
- Deletes do the inverse.

Reproduce it in the UI: view page 1 → **Insert movie** → **Next**.

### 3. Cursor: range on `_id`

```js
find({ _id: { $lt: lastSeenId } }).sort({ _id: -1 }).limit(limit)
```

The anchor is a **value**, not a position.

- **Pros**
  - **stable** under inserts/deletes (writes elsewhere can't move theanchor)
  - **O(log n)**: a B-tree seek, flat cost at any depth; no `skip` walk
- **Cons**
  - no random access (next/previous only)
  - no cheap `total`
  - needs a stable, unique, ordered sort key (`_id` or `createdAt` + tiebreaker).

Uses the `limit + 1` probe trick to compute `hasMore` without a second count query.

## Stack

- **Data**: MongoDB Atlas cluster (`sample_mflix.movies`, ~21k docs), provisioned with Terraform in `../infra`. 
- **Server**: `server/` — `node:http` + the official `mongodb` driver. Serves the static frontend and the JSON API from 
  one origin (no CORS).
- **Client**: `web/` — plain HTML/CSS and JS

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/movies/naive` | Return the **entire** collection in one response |
| GET | `/api/movies/offset?page=&limit=` | `skip` + `limit` offset pagination |
| GET | `/api/movies/cursor?after=&limit=` | Range pagination on `_id` |
| POST | `/api/movies/insert` | Insert a marked demo movie (`demo: true`) |
| POST | `/api/movies/reset` | Delete all demo movies |
| GET | `/api/health` | Ping |

Every pagination endpoint returns the **same shape**:

```json
{ "items": [], "count": 0, "total": null, "hasMore": false, "nextCursor": null }
```

`total` is `null` for cursor pagination (a count is a separate, expensive scan). `hasMore` / `nextCursor` are what the 
UI actually drives navigation from.
