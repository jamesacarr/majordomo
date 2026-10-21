import type {
  renderTelegramInputRequest,
  TelegramHandle,
  TelegramMessageBody,
} from 'eve/channels/telegram';

import type { MediaRef } from '../media/types';

/** eve's `InputRequest`, which `eve/channels/telegram` uses but doesn't export. */
export type InputRequest = Parameters<typeof renderTelegramInputRequest>[0];

/** The JSON body `channel.telegram.request` takes. */
export type TelegramApiBody = NonNullable<
  Parameters<TelegramHandle['request']>[1]
>;

/** `TelegramMessageBody` omits `parse_mode`, but eve spreads the body straight into `sendMessage`. */
export type HtmlMessageBody = TelegramMessageBody & {
  readonly parse_mode: 'HTML';
};

/** How `createOnInputRequested` renders one request, from `classifyRequest`. */
export type RequestPreview =
  | {
      readonly kind: 'pick';
      /** The options in button order, each with the title its id names. */
      readonly titles: readonly {
        readonly label: string;
        readonly ref: MediaRef;
      }[];
    }
  | { readonly kind: 'approval'; readonly ref: MediaRef }
  | { readonly kind: 'default' };
