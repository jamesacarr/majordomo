---
created_at: 2026-10-21T05:07:40Z
updated_at: 2026-10-21T05:59:26Z
status: accepted
---

# 0023. Show Seerr posters as one card per title

Decided 2026-10-21.

## Context

People choose between titles with `pick_media` (0021) and confirm requests with `request_media` (0006), and eve's Telegram renderer shows only the prompt and one button per option. A poster and a one-line summary would let a person recognise the right title at a glance.

The Telegram `input.requested` handler receives each `InputRequest` with its options and the tool call's `action.input`. Neither carries a poster. `pick_media` options are a strict `{ id, label, description?, style? }`, and its `action.input` is the model's list of TMDB refs. `request_media`'s input is the tool input. A poster URL needs TMDB's `posterPath`, which only Seerr knows.

## Decision

The handler fetches each title from Seerr again. It parses a `pick_media` option id (`movie:841`, decision 0021) or the `request_media` input, and reads `posterPath`, the title, the year and the summary from `/movie/{id}` or `/tv/{id}`. Fetches run in parallel under a 3-second deadline, so a stalled tunnel can't hold the buttons back for the client's 10-second timeout.

Before the keyboard, each title gets its own message, in button order. With a poster, that's a photo captioned with the bold numbered label and the summary. Without one, it's the same text alone. An approval gets one card with Seerr's title and year. The buttons gain the same `1. `, `2. ` prefixes, but only in the Telegram keyboard. eve still matches typed replies against the unnumbered labels, and a typed "2" resolves by index.

The preview is best effort:

- A title whose fetch fails or times out gets a bare numbered label, and an approval gets no card.
- A photo Telegram rejects, for example because TMDB has no image at that path, falls back to the text card.
- When every fetch fails, no cards are sent. A pick keeps its numbered buttons, so every pick looks the same.
- When Telegram answers 429 (too many requests) to a card, the remaining cards are skipped, and the keyboard waits for the `retry_after` Telegram gives, at most 10 seconds. A 429 means the chat is already over the limit, so a keyboard posted at once would be throttled too. Telegram asks for about one message a second per chat and tolerates short bursts, and a pick sends up to five messages back to back. Telegram names the wait, so there is no exponential backoff; past the cap, the keyboard is posted anyway and fails as eve's default would.

None of this is logged. `noConsole` is an error in `biome.json`, the repo has no logger, and eve's is internal. A text card where a photo should be is the signal.

Every other request renders exactly as eve's default. Overriding the handler replaces eve's, so the handler copies it. That includes registering the posted keyboard in channel state, which eve 0.81.1 doesn't export.

## Alternatives considered

- **One `sendMediaGroup` with a single numbered caption.** This was the ticket's design, and it takes two messages per pick instead of up to five. Rejected: album photos carry no numbers. Telegram lays out three or four as a mosaic, and a title with no poster shifts the rest. The single caption also has to fit four summaries into 1024 characters, and one bad poster URL fails the whole album.
- **Carry `posterPath` in the question.** Rejected: options have no field for it, and putting it in the id or the description would break the id contract from 0021.
- **A `defineState` slot written by the search tools.** Rejected for the reasons in 0021: reading state during workflow replay is unverified, and the slot goes stale across searches.
- **A themoviedb.org link and Telegram's link preview.** Rejected: one preview per message, and its content depends on TMDB's page metadata.
- **The approval card and keyboard as one photo message.** Rejected: eve clears an answered keyboard with `editMessageText`, which fails on a photo, so this would need an `input.resolved` override as well.

## Consequences

A pick costs up to four extra Seerr reads, on top of `pick_media`'s own four, and an approval costs one.

A pick takes up to five messages instead of two. Every pick leads to an approval (0006), so the chosen title's poster shows twice, and a pick-to-request flow takes up to seven messages. eve edits only the keyboard once a question is answered, so the cards stay in the chat as a record. Showing the poster once would need state shared between the two requests.

The approval poster belongs to the `tmdbId` that will be requested, so a person can spot a wrong id before approving. That includes two titles with the same name and year, which 0022 can't tell apart. 0022 remains the check that stops a mismatched request.

Telegram downloads poster images itself, and nothing bounds that send, as with eve's own sends.

eve truncates a button to 64 characters, and the number prefix uses three of them. A label near the limit loses the end of 0021's disambiguating suffix on the button, but its card shows the full label.
