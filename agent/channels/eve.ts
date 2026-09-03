import { localDev, vercelOidc } from 'eve/channels/auth';
import { eveChannel } from 'eve/channels/eve';

// The HTTP channel serves the eve dev TUI and evals only. Household users
// arrive through the Telegram channel, which carries its own allowlist.
export default eveChannel({
  auth: [
    // Vercel OIDC bearer tokens: the eve TUI pointed at a deployment, and
    // the deployment's own internal callers.
    vercelOidc(),
    // Synthetic principal for `eve dev`; authenticates nothing in production.
    localDev(),
  ],
});
