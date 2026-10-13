# Deploy on Railway

[`.railway/railway.ts`](../../.railway/railway.ts) declares the same stack as
[`deploy/compose.yaml`](../compose.yaml). Caddy is the only public service.

1. Create the project: `railway init --name peretyn`.
2. Add the shared variables `PERETYN_INTERNAL_SECRET` and `BETTER_AUTH_SECRET`
   (`openssl rand -hex 32` each) and `PERETYN_RESEND_API_KEY`.
3. Export a GitHub token that can read the images:
   `export GHCR_USERNAME=<github user> GHCR_TOKEN=<token with read:packages>`.
4. Set `PUBLIC_DOMAIN` in `railway.ts`, then run `railway config plan` and
   `railway config apply`.
5. Enroll the first admin:

   ```sh
   railway ssh --service control -- node services/control/dist/scripts/enroll.js you@example.com 'password' 'Your Name' --admin
   ```

Each stable release deploys through
[`deploy-railway.yaml`](../../.github/workflows/deploy-railway.yaml). It needs
the `RAILWAY_TOKEN` and `GHCR_TOKEN` secrets and the `GHCR_USERNAME` variable.
Run that workflow by hand to deploy any other change.

For a custom domain, run `railway domain <domain> --service caddy --port 8080`,
add the DNS records it prints, and set `PUBLIC_DOMAIN` to it once they verify.
