# Hotel Offer Orchestrator

Aggregates hotel offers from two mock suppliers, removes duplicates by hotel name, keeps the cheapest offer for each hotel, and lets you filter the result by price range.

**Stack:** Node.js (TypeScript), Express, Temporal, Redis, Docker Compose

## How it works

1. `GET /api/hotels?city=delhi` starts a Temporal workflow.
2. The workflow calls Supplier A and Supplier B **in parallel** (as Temporal activities, with retries).
3. Hotels are de-duplicated by name. If both suppliers list a hotel, the cheaper offer wins (a price tie goes to the higher commission).
4. The final list is saved in Redis, in a sorted set where the score is the price.
5. When `minPrice` and/or `maxPrice` is given, the filtering is done **inside Redis** with `ZRANGEBYSCORE`.
6. If one supplier is down, the workflow continues with the other one.

## Prerequisites

- Docker Desktop (running)

## Run

```bash
docker compose up --build
```

Wait until the logs show `Server running on http://localhost:3000` and `Worker started`.

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Temporal Web UI | http://localhost:8233 |

To stop: press `Ctrl + C`, then `docker compose down`.

## Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/hotels?city=delhi` | Best offer per hotel |
| `GET /api/hotels?city=delhi&minPrice=5000&maxPrice=6000` | Same, filtered by price in Redis |
| `GET /health` | Health of both suppliers and Redis (200 if all up, 503 if not) |
| `GET /supplierA/hotels?city=delhi` | Mock Supplier A |
| `GET /supplierB/hotels?city=delhi` | Mock Supplier B |
| `POST /supplierA/down`, `POST /supplierA/up` | Simulate Supplier A outage / recovery |
| `POST /supplierB/down`, `POST /supplierB/up` | Simulate Supplier B outage / recovery |

### Example

```bash
curl "localhost:3000/api/hotels?city=delhi"
```

```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

The response is sorted by price, cheapest first. A city with no hotels returns `[]`. A missing city or a non-numeric price returns `400`.

## Simulate a supplier being down

```bash
curl -X POST localhost:3000/supplierB/down
curl "localhost:3000/api/hotels?city=delhi"   # only Supplier A offers
curl localhost:3000/health                    # status: degraded
curl -X POST localhost:3000/supplierB/up
```

Note: results are cached in Redis for 5 minutes, so the price filter may serve the previous list until it expires or a new unfiltered request refreshes it.

## Postman

Import `postman/hotel-offer-orchestrator.postman_collection.json` and run the collection. It covers overlapping offers, price filters, a city with no results, invalid input, health checks, and a supplier outage.

## Project structure

```
src/
  server.ts            Express API, /health, mock suppliers
  mockSuppliers.ts     Two mock supplier endpoints with overlapping hotels
  dedupe.ts            Picks the cheapest offer per hotel
  redis.ts             Redis sorted-set save and price filter
  config.ts            Addresses and settings (from environment variables)
  worker.ts            Temporal worker
  temporal/
    workflows.ts       The orchestration workflow
    activities.ts      Supplier calls and Redis save
    client.ts          Starts the workflow from the API
postman/               Postman collection
Dockerfile
docker-compose.yml
```

## Design notes

- **Redis sorted set:** price is the score, so a price range query is one built-in Redis command.
- **`Promise.allSettled`:** one failing supplier does not fail the request.
- **Temporal:** activities retry automatically; every run is visible in the Web UI.
- **Temporal dev server:** used for simplicity. A production setup would use a Temporal cluster with a real database.