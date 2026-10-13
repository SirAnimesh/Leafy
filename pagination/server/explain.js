// A script to demonstrate the O(n) lookup time of offset-based pagination
// Run node --env-file=.env explain.js

import { MongoClient } from "mongodb"

const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const movies = client.db("sample_mflix").collection("movies")

// Offset: keys examined grows with skip, returned stays flat
for (const skip of [0, 5000, 20000]) {
  const { executionStats: s } = await movies
    .find({}).sort({ _id: -1 }).skip(skip).limit(24)
    .explain("executionStats")
  console.log(`skip ${skip.toString().padStart(5)} → keysExamined=${s.totalKeysExamined} docsExamined=${s.totalDocsExamined} returned=${s.nReturned} ${s.executionTimeMillis}ms`)
}

// Cursor: flat regardless of depth
const anchor = await movies.findOne({}, { sort: { _id: -1 }, skip: 20000 })
const { executionStats: c } = await movies
  .find({ _id: { $lt: anchor._id } }).sort({ _id: -1 }).limit(24)
  .explain("executionStats")
console.log(`cursor @20k → keysExamined=${c.totalKeysExamined} docsExamined=${c.totalDocsExamined} returned=${c.nReturned} ${c.executionTimeMillis}ms`)

await client.close()
