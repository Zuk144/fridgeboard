/**
 * Fake ESPN scoreboard JSON, shaped like site.api.espn.com/apis/site/v2/sports/.../scoreboard
 * (the sandbox can't reach ESPN, so this follows the documented shape, trimmed to the fields
 * that matter plus some of the noise around them). Matchups, ranks and networks are made up.
 */
import { at, type FakeFetch } from '../gas-harness';

export type League = 'nfl' | 'nba' | 'cfb';

export interface FakeTeam {
  location: string;
  name: string;
  abbr: string;
  /** ESPN's shortDisplayName: the nickname for the pros, the school for college. */
  short: string;
}

export interface FakeGame {
  away: FakeTeam;
  home: FakeTeam;
  /** Local kickoff, America/New_York, "2026-11-12T20:15". */
  at: string;
  /** broadcasts[0].names, the national networks. */
  nets: string[];
  /** Extra geoBroadcasts: local stations and streaming (some not on any list). */
  geo?: { type: 'TV' | 'Streaming' | 'Radio'; market: 'National' | 'Home' | 'Away'; name: string }[];
  state?: 'pre' | 'in' | 'post';
  /** AP ranks [away, home]; 0 = unranked (ESPN sends 99). */
  ranks?: [number, number];
}

const pro = (location: string, name: string, abbr: string): FakeTeam => ({ location, name, abbr, short: name });
const school = (location: string, name: string, abbr: string): FakeTeam => ({ location, name, abbr, short: location });

export const T = {
  bears: pro('Chicago', 'Bears', 'CHI'), packers: pro('Green Bay', 'Packers', 'GB'),
  steelers: pro('Pittsburgh', 'Steelers', 'PIT'), bengals: pro('Cincinnati', 'Bengals', 'CIN'),
  chiefs: pro('Kansas City', 'Chiefs', 'KC'), broncos: pro('Denver', 'Broncos', 'DEN'),
  cowboys: pro('Dallas', 'Cowboys', 'DAL'), niners: pro('San Francisco', '49ers', 'SF'),
  lions: pro('Detroit', 'Lions', 'DET'), vikings: pro('Minnesota', 'Vikings', 'MIN'),
  bills: pro('Buffalo', 'Bills', 'BUF'), jets: pro('New York', 'Jets', 'NYJ'),
  ravens: pro('Baltimore', 'Ravens', 'BAL'), browns: pro('Cleveland', 'Browns', 'CLE'),
  texans: pro('Houston', 'Texans', 'HOU'), jaguars: pro('Jacksonville', 'Jaguars', 'JAX'),
  falcons: pro('Atlanta', 'Falcons', 'ATL'), saints: pro('New Orleans', 'Saints', 'NO'),
  titans: pro('Tennessee', 'Titans', 'TEN'), colts: pro('Indianapolis', 'Colts', 'IND'),
  celtics: pro('Boston', 'Celtics', 'BOS'), sixers: pro('Philadelphia', '76ers', 'PHI'),
  nuggets: pro('Denver', 'Nuggets', 'DEN'), lakers: pro('Los Angeles', 'Lakers', 'LAL'),
  hornets: pro('Charlotte', 'Hornets', 'CHA'), magic: pro('Orlando', 'Magic', 'ORL'),
  kings: pro('Sacramento', 'Kings', 'SAC'), jazz: pro('Utah', 'Jazz', 'UTAH'),
  warriors: pro('Golden State', 'Warriors', 'GS'), rockets: pro('Houston', 'Rockets', 'HOU'),
  thunder: pro('Oklahoma City', 'Thunder', 'OKC'), wolves: pro('Minnesota', 'Timberwolves', 'MIN'),
  clippers: pro('LA', 'Clippers', 'LAC'), knicks: pro('New York', 'Knicks', 'NY'),
  heat: pro('Miami', 'Heat', 'MIA'), bucks: pro('Milwaukee', 'Bucks', 'MIL'),
  ohioState: school('Ohio State', 'Buckeyes', 'OSU'), purdue: school('Purdue', 'Boilermakers', 'PUR'),
  wake: school('Wake Forest', 'Demon Deacons', 'WAKE'), duke: school('Duke', 'Blue Devils', 'DUKE'),
  northwestern: school('Northwestern', 'Wildcats', 'NU'), iowa: school('Iowa', 'Hawkeyes', 'IOWA'),
  illinois: school('Illinois', 'Fighting Illini', 'ILL'), rutgers: school('Rutgers', 'Scarlet Knights', 'RUTG'),
  georgia: school('Georgia', 'Bulldogs', 'UGA'), oleMiss: school('Ole Miss', 'Rebels', 'MISS'),
  pennState: school('Penn State', 'Nittany Lions', 'PSU'), michigan: school('Michigan', 'Wolverines', 'MICH'),
  memphis: school('Memphis', 'Tigers', 'MEM'), utsa: school('UTSA', 'Roadrunners', 'UTSA'),
  kansas: school('Kansas', 'Jayhawks', 'KU'), baylor: school('Baylor', 'Bears', 'BAY'),
  aggies: school('Texas A&M', 'Aggies', 'TA&M'), missouri: school('Missouri', 'Tigers', 'MIZ'),
  oregon: school('Oregon', 'Ducks', 'ORE'), usc: school('USC', 'Trojans', 'USC'),
  indiana: school('Indiana', 'Hoosiers', 'IU'), notreDame: school('Notre Dame', 'Fighting Irish', 'ND'),
  texas: school('Texas', 'Longhorns', 'TEX'), oklahoma: school('Oklahoma', 'Sooners', 'OU'),
  tennessee: school('Tennessee', 'Volunteers', 'TENN'), kentucky: school('Kentucky', 'Wildcats', 'UK'),
  tulane: school('Tulane', 'Green Wave', 'TULN'), navy: school('Navy', 'Midshipmen', 'NAVY'),
};

let nextId = 401770000;

/** ESPN writes dates as "2026-11-13T01:15Z". */
function espnDate(local: string): string {
  return at(local).toISOString().replace(/:\d\d\.\d{3}Z$/, 'Z');
}

function competitor(t: FakeTeam, side: 'home' | 'away', rank: number | undefined, league: League) {
  const c: Record<string, unknown> = {
    id: String(nextId % 997), type: 'team', order: side === 'home' ? 0 : 1, homeAway: side, winner: false,
    team: {
      id: String(nextId % 991), location: t.location, name: t.name, abbreviation: t.abbr,
      displayName: `${t.location} ${t.name}`, shortDisplayName: t.short, color: '1e2b4a', alternateColor: 'ffffff',
      isActive: true, logo: `https://a.espncdn.com/i/teamlogos/${league}/500/scoreboard/${t.abbr.toLowerCase()}.png`,
    },
    score: '0',
    records: [{ name: 'overall', abbreviation: 'Any', type: 'total', summary: '6-3' }],
  };
  if (league === 'cfb') c.curatedRank = { current: rank || 99 };
  return c;
}

const STATUS = {
  pre: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, description: 'Scheduled' },
  in: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, description: 'In Progress' },
  post: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, description: 'Final' },
};

export function espnEvent(league: League, g: FakeGame) {
  const id = String(nextId++);
  const date = espnDate(g.at);
  const status = { clock: 0, displayClock: '0:00', period: g.state === 'in' ? 2 : 0, type: { ...STATUS[g.state || 'pre'], detail: g.at, shortDetail: g.at } };
  const geo = [
    ...g.nets.map((n) => ({ type: { id: '1', shortName: 'TV' }, market: { id: '1', type: 'National' }, media: { shortName: n }, lang: 'en', region: 'us' })),
    ...(g.geo || []).map((x) => ({ type: { id: x.type === 'TV' ? '1' : '4', shortName: x.type }, market: { id: '2', type: x.market }, media: { shortName: x.name }, lang: 'en', region: 'us' })),
  ];
  return {
    id, uid: `s:20~l:28~e:${id}`, date,
    name: `${g.away.location} ${g.away.name} at ${g.home.location} ${g.home.name}`,
    shortName: `${g.away.abbr} @ ${g.home.abbr}`,
    season: { year: 2026, type: 2, slug: 'regular-season' },
    competitions: [{
      id, uid: `s:20~l:28~e:${id}~c:${id}`, date, attendance: 0, timeValid: true, neutralSite: false,
      venue: { id: '3798', fullName: 'Somewhere Stadium', address: { city: 'Anytown', state: 'PA' }, indoor: false },
      competitors: [competitor(g.home, 'home', g.ranks?.[1], league), competitor(g.away, 'away', g.ranks?.[0], league)],
      notes: [], status,
      broadcasts: g.nets.length ? [{ market: 'national', names: g.nets }] : [],
      broadcast: g.nets.join('/'),
      geoBroadcasts: geo,
      odds: [{ provider: { name: 'ESPN BET' }, details: '-3.5', overUnder: 44.5 }],
    }],
    links: [{ rel: ['summary', 'desktop', 'event'], href: `https://www.espn.com/${league}/game/_/gameId/${id}` }],
    status,
  };
}

export function scoreboard(league: League, games: FakeGame[]) {
  const names = { nfl: 'National Football League', nba: 'National Basketball Association', cfb: 'NCAA - Football' };
  return {
    leagues: [{ id: '28', name: names[league], abbreviation: league.toUpperCase(), season: { year: 2026 } }],
    season: { type: 2, year: 2026 },
    events: games.map((g) => espnEvent(league, g)),
  };
}

export type EspnDay = Partial<Record<League, FakeGame[] | { code: number; text?: string }>>;

/** Routes the script's ESPN requests to fake scoreboards (or a fake failure). */
export function espnFetch(day: EspnDay): FakeFetch {
  return (url) => {
    if (!url.includes('site.api.espn.com')) return undefined;
    const league: League = url.includes('/basketball/nba/') ? 'nba' : url.includes('/college-football/') ? 'cfb' : 'nfl';
    const v = day[league];
    if (!v) return { code: 200, text: JSON.stringify(scoreboard(league, [])) };
    if (Array.isArray(v)) return { code: 200, text: JSON.stringify(scoreboard(league, v)) };
    return { code: v.code, text: v.text ?? '' };
  };
}

const local = (name: string) => [{ type: 'TV' as const, market: 'Home' as const, name }, { type: 'TV' as const, market: 'Away' as const, name: `${name}-2` }];

/** The dev and test TV days (frame §9): Thursday night, a busy college Saturday, a Steelers Sunday, a quiet Tuesday. */
export const TV_DAYS: Record<string, EspnDay> = {
  thursday: {
    nfl: [
      { away: T.bears, home: T.packers, at: '2026-11-12T20:15', nets: ['Prime Video'], geo: [{ type: 'TV', market: 'Home', name: 'WLUK' }, { type: 'Radio', market: 'National', name: 'Westwood One' }] },
    ],
    nba: [
      { away: T.hornets, home: T.magic, at: '2026-11-12T19:00', nets: [], geo: local('FDSNFL'), state: 'in' },
      { away: T.celtics, home: T.sixers, at: '2026-11-12T19:30', nets: ['Prime Video'], geo: local('NBCSB'), state: 'in' },
      { away: T.kings, home: T.jazz, at: '2026-11-12T21:00', nets: [], geo: local('KJZZ') },
      { away: T.nuggets, home: T.lakers, at: '2026-11-12T22:00', nets: ['Prime Video'], geo: local('Altitude') },
    ],
    cfb: [
      { away: T.navy, home: T.memphis, at: '2026-11-12T19:30', nets: ['ESPN'], state: 'in', ranks: [0, 0] },
    ],
  },
  saturday: {
    cfb: [
      { away: T.ohioState, home: T.purdue, at: '2026-11-14T12:00', nets: ['FOX'], state: 'in', ranks: [2, 0] },
      { away: T.wake, home: T.duke, at: '2026-11-14T12:00', nets: ['ESPN'], state: 'in', ranks: [0, 0] },
      { away: T.northwestern, home: T.iowa, at: '2026-11-14T12:00', nets: ['ABC'], state: 'in', ranks: [0, 0] },
      { away: T.illinois, home: T.rutgers, at: '2026-11-14T12:00', nets: ['BTN'], state: 'in', ranks: [21, 0] },
      { away: T.georgia, home: T.oleMiss, at: '2026-11-14T15:30', nets: ['CBS'], ranks: [5, 12] },
      { away: T.pennState, home: T.michigan, at: '2026-11-14T15:30', nets: ['ABC', 'ESPN2'], ranks: [9, 3] },
      { away: T.memphis, home: T.utsa, at: '2026-11-14T15:30', nets: ['ESPN+'], geo: [{ type: 'Streaming', market: 'National', name: 'ESPN+' }], ranks: [24, 0] },
      { away: T.kansas, home: T.baylor, at: '2026-11-14T15:30', nets: ['FS1'], ranks: [0, 0] },
      { away: T.aggies, home: T.missouri, at: '2026-11-14T16:00', nets: ['SECN'], ranks: [15, 0] },
      { away: T.oregon, home: T.usc, at: '2026-11-14T19:00', nets: ['ESPN'], ranks: [7, 0] },
      { away: T.indiana, home: T.notreDame, at: '2026-11-14T19:30', nets: ['NBC', 'Peacock'], ranks: [1, 8] },
      { away: T.texas, home: T.oklahoma, at: '2026-11-14T19:30', nets: ['ABC'], ranks: [4, 10] },
      { away: T.tennessee, home: T.kentucky, at: '2026-11-14T20:00', nets: ['SEC Network'], ranks: [19, 0] },
    ],
    nba: [
      { away: T.warriors, home: T.rockets, at: '2026-11-14T20:30', nets: ['ABC'] },
      { away: T.heat, home: T.bucks, at: '2026-11-14T20:00', nets: [], geo: local('FDSNWI') },
    ],
  },
  sunday: {
    nfl: [
      { away: T.lions, home: T.vikings, at: '2026-11-15T13:00', nets: ['FOX'], state: 'in' },
      { away: T.bills, home: T.jets, at: '2026-11-15T13:00', nets: ['CBS'], state: 'post' },
      { away: T.ravens, home: T.browns, at: '2026-11-15T13:00', nets: ['CBS'], state: 'in' },
      { away: T.texans, home: T.jaguars, at: '2026-11-15T13:00', nets: ['CBS'], state: 'in' },
      { away: T.falcons, home: T.saints, at: '2026-11-15T13:00', nets: ['FOX'], state: 'in' },
      { away: T.chiefs, home: T.broncos, at: '2026-11-15T16:05', nets: ['CBS'] },
      { away: T.cowboys, home: T.niners, at: '2026-11-15T16:25', nets: ['FOX'] },
      { away: T.titans, home: T.colts, at: '2026-11-15T16:25', nets: ['FOX'] },
      { away: T.steelers, home: T.bengals, at: '2026-11-15T20:20', nets: ['NBC', 'Peacock'], geo: [{ type: 'TV', market: 'Home', name: 'WLWT' }] },
    ],
    nba: [
      { away: T.thunder, home: T.wolves, at: '2026-11-15T19:00', nets: ['NBA TV'], geo: local('FDSNOK') },
      { away: T.lakers, home: T.clippers, at: '2026-11-15T21:30', nets: ['Peacock'], geo: local('Spectrum SportsNet') },
    ],
  },
  quiet: {
    nba: [
      { away: T.hornets, home: T.magic, at: '2026-11-10T19:00', nets: [], geo: local('FDSNFL') },
      { away: T.kings, home: T.jazz, at: '2026-11-10T21:00', nets: [], geo: local('KJZZ') },
    ],
    cfb: [
      { away: T.tulane, home: T.navy, at: '2026-11-10T19:30', nets: ['ESPN2'], ranks: [0, 0] },
    ],
  },
};
