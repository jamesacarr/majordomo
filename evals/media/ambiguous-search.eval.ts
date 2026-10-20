import { defineEval } from 'eve/evals';

export default defineEval({
  description:
    'A title with several plausible matches asks which one, with "Title (Year)" labels and no recommended marker.',
  async test(t) {
    const turn = await t.send("Who's in Dune?");

    t.parked();
    t.calledTool('search_media', { input: { query: /dune/iu } });
    turn.session.requireInputRequest({
      optionIds: ids => ids.length > 1,
      toolName: 'ask_question',
    });
    t.eventsSatisfy(
      'every option is labelled "Title (Year)" with no marker',
      events =>
        events.some(
          event =>
            event.type === 'input.requested' &&
            event.data.requests.some(request =>
              request.options?.every(
                option =>
                  /\(\d{4}\b[^)]*\)/u.test(option.label) &&
                  !/recommended/iu.test(option.label),
              ),
            ),
        ),
    );
  },
});
