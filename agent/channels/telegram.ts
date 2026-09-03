import { telegramChannel } from 'eve/channels/telegram';

import { createOnMessage } from '../lib/telegram/create-on-message';
import { onMessageCompleted } from '../lib/telegram/on-message-completed';

// Binding only; the behaviour and its tests live under agent/lib/telegram/.
// Credentials come from TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET_TOKEN.
// No botUsername: it only drives group mention detection, and groups are dropped.
export default telegramChannel({
  events: { 'message.completed': onMessageCompleted },
  onMessage: createOnMessage(),
});
