curl -sS "$PERETYN_RUNTIME_URL/v1/check" \
  -H "Authorization: Bearer $PERETYN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "tuple_key": { "user": "user:alice", "relation": "can_view", "object": "document:roadmap" }
  }'
