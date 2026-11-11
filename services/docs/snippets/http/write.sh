curl -sS "$PERETYN_RUNTIME_URL/v1/write" \
  -H "Authorization: Bearer $PERETYN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "writes": {
      "tuple_keys": [
        { "user": "user:alice", "relation": "owner", "object": "document:roadmap" },
        { "user": "user:bob", "relation": "viewer", "object": "document:specs" }
      ]
    }
  }'
