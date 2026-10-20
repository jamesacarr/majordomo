// Seerr 3.4.1 answers for the titles the evals ask about, trimmed to the
// fields majordomo reads plus a few it ignores. TMDB ids are real.

const movie = (
  id: number,
  title: string,
  releaseDate: string,
  overview: string,
  {
    status,
    voteAverage = 7,
    voteCount = 5_000,
  }: {
    readonly status?: number;
    readonly voteAverage?: number;
    readonly voteCount?: number;
  } = {},
) => ({
  id,
  mediaType: 'movie',
  overview,
  popularity: 50,
  posterPath: `/${id}.jpg`,
  releaseDate,
  title,
  voteAverage,
  voteCount,
  ...(status === undefined ? {} : { mediaInfo: { status, tmdbId: id } }),
});

const fightClub = movie(
  550,
  'Fight Club',
  '1999-10-15',
  'An insomniac office worker and a soap salesman form an underground fight club.',
  { status: 5, voteAverage: 8.4, voteCount: 30_000 },
);

const dune2021 = movie(
  438_631,
  'Dune',
  '2021-09-15',
  'Paul Atreides, a brilliant and gifted young man, travels to the most dangerous planet in the universe.',
  { voteAverage: 7.8 },
);

const dune1984 = movie(
  841,
  'Dune',
  '1984-12-14',
  'In the year 10,191, the spice melange is the most precious substance in the universe.',
  { voteAverage: 6.3 },
);

const duneTwo = movie(
  693_134,
  'Dune: Part Two',
  '2024-02-27',
  'Paul Atreides unites with Chani and the Fremen while seeking revenge.',
  { status: 3, voteAverage: 8.2 },
);

const duneMiniseries = {
  firstAirDate: '2000-12-03',
  id: 1_910,
  mediaType: 'tv',
  name: "Frank Herbert's Dune",
  overview: 'A three-part adaptation of the novel, made for television.',
  posterPath: null,
  voteAverage: 6.9,
  voteCount: 300,
};

/** Search results by a word the query must contain, lower case. */
export const SEARCH_RESULTS: Readonly<Record<string, readonly unknown[]>> = {
  dune: [
    dune2021,
    dune1984,
    duneTwo,
    duneMiniseries,
    {
      id: 1_190_668,
      knownFor: [],
      mediaType: 'person',
      name: 'Timothée Chalamet',
    },
  ],
  'fight club': [fightClub],
};

/** `/movie/{id}` and `/tv/{id}` answers, by path. */
export const DETAILS: Readonly<Record<string, unknown>> = {
  '/movie/841': {
    ...dune1984,
    credits: {
      cast: [
        {
          character: 'Paul Atreides',
          id: 6_677,
          name: 'Kyle MacLachlan',
          order: 0,
        },
        {
          character: 'Lady Jessica',
          id: 2_632,
          name: 'Francesca Annis',
          order: 1,
        },
      ],
      crew: [
        {
          department: 'Directing',
          id: 5_602,
          job: 'Director',
          name: 'David Lynch',
        },
      ],
    },
    genres: [{ id: 878, name: 'Science Fiction' }],
    runtime: 137,
  },
  '/movie/438631': {
    ...dune2021,
    credits: {
      cast: [
        {
          character: 'Paul Atreides',
          id: 1_190_668,
          name: 'Timothée Chalamet',
          order: 0,
        },
        {
          character: 'Lady Jessica Atreides',
          id: 933_238,
          name: 'Rebecca Ferguson',
          order: 1,
        },
        {
          character: 'Duke Leto Atreides',
          id: 1_640,
          name: 'Oscar Isaac',
          order: 2,
        },
      ],
      crew: [
        {
          department: 'Directing',
          id: 137_427,
          job: 'Director',
          name: 'Denis Villeneuve',
        },
      ],
    },
    genres: [
      { id: 878, name: 'Science Fiction' },
      { id: 12, name: 'Adventure' },
    ],
    runtime: 155,
  },
};

/** Recommendations and similar titles for Fight Club. */
export const RELATED: Readonly<Record<string, readonly unknown[]>> = {
  '/movie/550/recommendations': [
    movie(
      807,
      'Se7en',
      '1995-09-22',
      'Two detectives hunt a serial killer who uses the seven deadly sins as his motives.',
      { status: 5, voteAverage: 8.4 },
    ),
    movie(
      680,
      'Pulp Fiction',
      '1994-09-10',
      'The lives of two mob hitmen, a boxer and a pair of bandits intertwine.',
      { voteAverage: 8.5 },
    ),
    movie(
      77,
      'Memento',
      '2000-10-11',
      'A man with short-term memory loss hunts his wife’s killer.',
      { voteAverage: 8.2 },
    ),
    movie(
      1_359,
      'American Psycho',
      '2000-04-13',
      'A wealthy New York banker hides a violent double life.',
      { voteAverage: 7.4 },
    ),
  ],
  '/movie/550/similar': [
    movie(
      77,
      'Memento',
      '2000-10-11',
      'A man with short-term memory loss hunts his wife’s killer.',
      { voteAverage: 8.2 },
    ),
    movie(
      629,
      'The Usual Suspects',
      '1995-07-19',
      'A sole survivor tells the police how five criminals met.',
      { voteAverage: 8.2 },
    ),
    movie(
      4_553,
      'The Machinist',
      '2004-01-18',
      'An industrial worker who hasn’t slept in a year doubts his sanity.',
      { voteAverage: 7.5 },
    ),
  ],
};
