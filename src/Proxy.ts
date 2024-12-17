type GuessIdKeyType = Date;
type GuessIdType = number;
type Fetcher = (url: URL) => Promise<Response>;
type GetCurrentDate = () => Date;

export interface GuessResponse {
  sim: number;
  rank?: string;
}

export class Proxy {
  private static readonly KOMANTLE_URL_STRING =
    "https://semantle-ko.newsjel.ly/";
  private static readonly ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
  private guessIds: Map<GuessIdKeyType, GuessIdType> = new Map();

  private constructor(
    private readonly baseUrl: URL,
    private readonly fetch: Fetcher,
    private readonly getCurrentDate: GetCurrentDate
  ) {}

  public async guess(
    word: string,
    date: Date = this.getCurrentDate()
  ): Promise<GuessResponse> {
    try {
      const guessUrlBase = await this.buildGuessUrlByDate(date);
      const guessUrl = this.buildUrl(guessUrlBase, word);
      const response = await this.getRequest<Partial<GuessResponse>>(guessUrl);

      if (!response) {
        throw new Error(`error occurred during guess: invalid response`);
      }

      const simKey = "sim";
      const sim = response[simKey];
      if (!sim) {
        throw new Error(`error occurred during guess: ${simKey} not defined`);
      }
      const rankKey = "rank";
      const rank = response[rankKey];
      if (!rank) {
        throw new Error(`error occurred during guess: ${rankKey} not defined`);
      }

      return { sim, rank };
    } catch (error) {
      console.error(error);
      throw new Error("error occurred during guess");
    }
  }

  private async buildGuessUrlByDate(date: Date): Promise<URL> {
    const key = this.buildGuessIdKey(date);
    const guessId = await this.getGuessId(key);
    return this.buildUrl(this.baseUrl, `/guess/${guessId}`);
  }

  private async getGuessId(key: GuessIdKeyType): Promise<GuessIdType> {
    if (!this.isValidGuessIdKey(key)) {
      throw new Error(
        `error occurred during get guess id: invalid guess id key ${key}`
      );
    }
    const knownGuessId = this.guessIds.get(key);
    if (knownGuessId) {
      return knownGuessId;
    }

    const today = this.getToday();
    const dateDiff = this.differenceInDays(today, key);
    const todayId = await this.getTodayId();
    const guessId = todayId - dateDiff;
    this.putGuessId(key, guessId);
    return guessId;
  }

  private async getTodayId(): Promise<GuessIdType> {
    const todayPath = "today";
    const getTodayUrl = new URL(todayPath, this.baseUrl);
    const response = await this.getRequest(getTodayUrl);

    const todayIdKey = "answer_id";
    const todayId = response[todayIdKey];
    if (!todayId) {
      throw new Error(
        `error occurred during fetch today id: ${todayIdKey} not defined`
      );
    }
    return todayId;
  }

  private differenceInDays(a: Date, b: Date): number {
    const diffInMilliSeconds = Math.abs(a.getTime() - b.getTime());
    return Math.round(diffInMilliSeconds / Proxy.ONE_DAY_IN_MILLISECONDS);
  }

  private isValidGuessIdKey(date: Date): boolean {
    const today = this.getToday();
    return date.getTime() < today.getTime();
  }

  private buildGuessIdKey(date: Date): GuessIdKeyType {
    const guessIdKey = new Date(date);
    guessIdKey.setHours(0, 0, 0, 0);
    return guessIdKey;
  }

  private getToday(): Date {
    return this.getCurrentDate();
  }

  private putGuessId(key: Date, guessId: GuessIdType): this {
    this.guessIds.set(key, guessId);
    return this;
  }

  private async getRequest<Response = any>(url: URL): Promise<Response> {
    const response = await this.fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch ${url.href}: ${response.statusText}`);
    }
    try {
      return await response.json();
    } catch (error) {
      throw new Error(`invalid json response from ${url.href}`);
    }
  }

  private buildUrl(base: URL, path: string): URL {
    const url = new URL(base.href);
    url.pathname = `${url.pathname.replace(/\/$/, "")}/${path.replace(
      /^\//,
      ""
    )}`;
    return url;
  }

  public static with(
    fetcher: Fetcher,
    url: string = Proxy.KOMANTLE_URL_STRING,
    getCurrentDate: GetCurrentDate = () => new Date()
  ): Proxy {
    return new Proxy(new URL(url), fetcher, getCurrentDate);
  }
}
