# Pagination

Strategies explored:

- Naive, no pagination, database sends the entire collection in one response
- Offset, skip + limit

## Offset pagination

`skip` paginates by position and positions are not stable in a live database. Two failures:

- `skip` is `O(n)`. Server walks every skipped doc. Page 2 maybe instant but page 900 won't.
- unstable under writes
  - load page 1 (docs 1-24)
  - insert a new doc at the top
  - click Next -> `skip: 24` -> due to the new insert doc that was #24 is now #25 and shows up again
  - deletes do the inverse of writes


