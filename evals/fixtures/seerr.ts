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

// The Mad Max films, for sequel shorthand: the fourth film's title has no
// number, so "Mad Max 4" matches it only by knowing the series.
const madMax = movie(
  9_659,
  'Mad Max',
  '1979-04-12',
  'In a dystopian future Australia, a police officer hunts the biker gang that killed his family.',
);

const madMaxTwo = movie(
  8_810,
  'Mad Max 2',
  '1981-12-24',
  'Max helps a community of settlers defend their fuel refinery from a gang of marauders.',
);

const thunderdome = movie(
  9_355,
  'Mad Max Beyond Thunderdome',
  '1985-08-06',
  'Exiled into the desert, Max finds a band of children waiting for a saviour.',
);

const furyRoad = movie(
  76_341,
  'Mad Max: Fury Road',
  '2015-05-14',
  'Max teams up with Imperator Furiosa to flee a tyrant across the wasteland.',
  { voteAverage: 7.6 },
);

const furiosa = movie(
  786_892,
  'Furiosa: A Mad Max Saga',
  '2024-05-23',
  'Young Furiosa is taken from the Green Place and fights to find her way home.',
);

// Not-requested films, one per request eval, so each eval can find its own
// POST by `mediaId` while evals run concurrently.
const arrival = movie(
  329_865,
  'Arrival',
  '2016-11-10',
  'A linguist works with the military to communicate with alien lifeforms after twelve spacecraft land.',
  { voteAverage: 7.6 },
);

const heat = movie(
  949,
  'Heat',
  '1995-12-15',
  'A career thief and the detective obsessed with catching him circle each other in Los Angeles.',
  { voteAverage: 7.9 },
);

const bladeRunner = movie(
  78,
  'Blade Runner',
  '1982-06-25',
  'A blade runner must pursue and terminate four replicants who have returned to Earth.',
  { voteAverage: 7.9 },
);

const alien = movie(
  348,
  'Alien',
  '1979-05-25',
  'The crew of a commercial spacecraft meets a deadly lifeform after investigating a distress call.',
  { voteAverage: 8.2 },
);

// Credits for the person evals. Brad Pitt's include a talk-show appearance, a
// one-episode guest spot and a producer-only credit, each with enough votes
// to rank first if findPersonCredits didn't drop it.
const se7en = movie(
  807,
  'Se7en',
  '1995-09-22',
  'Two detectives hunt a serial killer who uses the seven deadly sins as his motives.',
  { voteAverage: 8.4, voteCount: 20_000 },
);

const moneyball = movie(
  60_308,
  'Moneyball',
  '2011-09-22',
  "A baseball team's general manager rebuilds his club on a tight budget using statistics.",
  { voteAverage: 7.2, voteCount: 8_000 },
);

const onceUponATime = movie(
  466_272,
  'Once Upon a Time... in Hollywood',
  '2019-07-24',
  'A fading television actor and his stunt double look for work in 1969 Los Angeles.',
  { voteAverage: 7.4, voteCount: 15_000 },
);

const twelveYearsASlave = movie(
  76_203,
  '12 Years a Slave',
  '2013-10-18',
  'A free Black man from New York is kidnapped and sold into slavery.',
  { voteAverage: 7.9, voteCount: 12_000 },
);

const goodBadUgly = movie(
  429,
  'The Good, the Bad and the Ugly',
  '1966-12-23',
  'Three gunslingers race to find a fortune in buried Confederate gold.',
  { voteAverage: 8.5, voteCount: 9_000 },
);

const granTorino = movie(
  13_223,
  'Gran Torino',
  '2008-12-09',
  'A grieving Korean War veteran befriends the teenage neighbour who tried to steal his car.',
  { voteAverage: 7.8, voteCount: 10_000 },
);

const unforgiven = movie(
  33,
  'Unforgiven',
  '1992-08-07',
  'A retired gunslinger takes one last job to collect a bounty on two cowboys.',
  { voteAverage: 7.9, voteCount: 6_000 },
);

const millionDollarBaby = movie(
  70,
  'Million Dollar Baby',
  '2004-12-15',
  'A hardened boxing trainer takes on a determined amateur fighter.',
  { voteAverage: 7.9, voteCount: 7_000 },
);

const directed = { department: 'Directing', job: 'Director' };

/** Search results by a word the query must contain, lower case. */
export const SEARCH_RESULTS: Readonly<Record<string, readonly unknown[]>> = {
  alien: [alien],
  arrival: [arrival],
  'blade runner': [bladeRunner],
  'brad pitt': [
    fightClub,
    {
      id: 287,
      knownFor: [],
      mediaType: 'person',
      name: 'Brad Pitt',
      popularity: 30,
    },
  ],
  'clint eastwood': [
    granTorino,
    {
      id: 190,
      knownFor: [],
      mediaType: 'person',
      name: 'Clint Eastwood',
      popularity: 20,
    },
  ],
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
  heat: [heat],
  'mad max': [madMax, furyRoad, madMaxTwo, furiosa, thunderdome],
};

/** `/movie/{id}` and `/tv/{id}` answers, by path. */
export const DETAILS: Readonly<Record<string, unknown>> = {
  '/movie/78': bladeRunner,
  '/movie/348': alien,
  '/movie/550': fightClub,
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
  '/movie/949': heat,
  '/movie/60308': moneyball,
  '/movie/76341': {
    ...furyRoad,
    credits: {
      cast: [
        {
          character: 'Max Rockatansky',
          id: 2_524,
          name: 'Tom Hardy',
          order: 0,
        },
        {
          character: 'Imperator Furiosa',
          id: 6_885,
          name: 'Charlize Theron',
          order: 1,
        },
      ],
      crew: [
        {
          department: 'Directing',
          id: 20_629,
          job: 'Director',
          name: 'George Miller',
        },
      ],
    },
    genres: [
      { id: 28, name: 'Action' },
      { id: 12, name: 'Adventure' },
      { id: 878, name: 'Science Fiction' },
    ],
    runtime: 121,
  },
  '/movie/329865': arrival,
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
  '/movie/693134': {
    ...duneTwo,
    credits: {
      cast: [
        {
          character: 'Paul Atreides',
          id: 1_190_668,
          name: 'Timothée Chalamet',
          order: 0,
        },
        { character: 'Chani', id: 505_710, name: 'Zendaya', order: 1 },
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
    runtime: 167,
  },
  '/tv/1910': {
    ...duneMiniseries,
    createdBy: [{ id: 1_911, name: 'John Harrison' }],
    credits: {
      cast: [
        {
          character: 'Paul Atreides',
          id: 7_060,
          name: 'Alec Newman',
          order: 0,
        },
        {
          character: 'Duke Leto Atreides',
          id: 1_925,
          name: 'William Hurt',
          order: 1,
        },
      ],
    },
    genres: [{ id: 10_765, name: 'Sci-Fi & Fantasy' }],
    numberOfSeasons: 1,
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

/** `/person/{id}/combined_credits` answers, by path. */
export const PERSON_CREDITS: Readonly<Record<string, unknown>> = {
  '/person/190/combined_credits': {
    cast: [
      { ...goodBadUgly, character: 'Blondie' },
      { ...granTorino, character: 'Walt Kowalski' },
    ],
    crew: [
      { ...granTorino, ...directed },
      { ...unforgiven, ...directed },
      { ...millionDollarBaby, ...directed },
    ],
    id: 190,
  },
  '/person/287/combined_credits': {
    cast: [
      {
        character: 'Self',
        firstAirDate: '2014-02-17',
        id: 59_941,
        mediaType: 'tv',
        name: 'The Tonight Show Starring Jimmy Fallon',
        overview: 'Jimmy Fallon hosts the late-night talk show.',
        posterPath: null,
        voteAverage: 6.5,
        voteCount: 50_000,
      },
      {
        character: 'Will Colbert',
        episodeCount: 1,
        firstAirDate: '1994-09-22',
        id: 1_668,
        mediaType: 'tv',
        name: 'Friends',
        overview: 'Six friends navigate life and love in New York City.',
        posterPath: null,
        voteAverage: 8.4,
        voteCount: 40_000,
      },
      { ...fightClub, character: 'Tyler Durden' },
      { ...se7en, character: 'Detective David Mills' },
      { ...onceUponATime, character: 'Cliff Booth' },
      { ...moneyball, character: 'Billy Beane' },
    ],
    crew: [{ ...twelveYearsASlave, department: 'Production', job: 'Producer' }],
    id: 287,
  },
};
