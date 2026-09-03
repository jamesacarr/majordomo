import { telegramChannel } from 'eve/channels/telegram';

import { onMessageCompleted } from '../lib/telegram/deliver';
import { createOnMessage } from '../lib/telegram/on-message';

// Binding only; the behaviour and its tests live under agent/lib/telegram/.
// Credentials come from TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET_TOKEN.
// No botUsername: it only drives group mention detection, and groups are dropped.
export default telegramChannel({
  events: { 'message.completed': onMessageCompleted },
  onMessage: createOnMessage(),
});
