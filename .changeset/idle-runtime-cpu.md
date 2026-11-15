---
"@peretyn/runtime": patch
---

Stop the runtime burning CPU while idle by turning off OpenFGA dispatch throttling, whose tickers woke up every 10µs.
