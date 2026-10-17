# Deploy

`compose.yaml` runs the stack on one host. Caddy terminates TLS and is the only
service that publishes ports.

1. Point your domain's DNS at the host and open ports 80 and 443.
2. Get the files:

   ```sh
   mkdir -p /opt/peretyn && cd /opt/peretyn
   base=https://raw.githubusercontent.com/peretyn/peretyn/main/deploy
   curl -fsSLO "$base/compose.yaml"
   curl -fsSLO "$base/Caddyfile"
   curl -fsSL "$base/.env.example" -o .env
   ```

3. Fill in `.env`. Generate each secret with `openssl rand -hex 32`. Auth email
   needs `PERETYN_RESEND_API_KEY`.
4. Start the stack and enroll the first admin. Signup is closed by default.

   ```sh
   docker login ghcr.io
   docker compose up -d
   docker compose exec control node services/control/dist/scripts/enroll.js you@example.com 'password' 'Your Name' --admin
   ```

Enroll other users the same way, without `--admin`. Admins manage users through
better-auth's admin endpoints under `/api/auth/admin/*`.

To upgrade, change `PERETYN_TAG` and run `docker compose pull && docker compose up -d`.
All data is in the `postgres-data` volume; back it up with `pg_dump`.
