curl -sS "$PERETYN_RUNTIME_URL/v1/list-objects" \
  -H "Authorization: Bearer $PERETYN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{ "type": "document", "relation": "can_view", "user": "user:bob" }'
