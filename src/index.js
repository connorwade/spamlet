import { chromium, firefox, webkit } from "playwright";
import { getNextOpenPort } from "./getPort.js";
import { sleep } from "./utils.js";

/**
 * Create a new Spamlet crawler object
 * @class
 */
export default class Spamlet {
  /**@lends Spamlet */

  /**
   * A set of the URL's that this Spamlet instance has visited.
   * @type {Set<string>}
   */
  visitedUrls = new Set();
  /**
   * The callback stack for Spamlet.
   * @type {{
   * type: string,
   * url?: URL | string,
   * base?: URL |string,
   * res?: import('playwright').Response,
   * depth?: number}[]
   * }
   */
  cbStack = [];
  /**
   * The port that Spamlet is using for its browser.
   * @type {number}
   */
  port;

  /**
   * The current page being processed by Spamlet
   * @type {URL}
   */
  currentPage = new URL("https://example.com");

  /**
   * The onSelector callbacks that run when Spamlet encounters selectors
   * @type {SelectorCallbackContainer}
   */
  onSelectorCallbacks = [];
  /**
   * The onPageLoad callbacks that run when a page loads
   * @type {PageLoadCallbackContainer}
   */
  onPageLoadCallbacks = [];
  /**
   * The onPageResponse callbacks that run when a page response is read by Spamlet
   * @type {PageResponseCallbackContainer}
   */
  onPageResponseCallbacks = [];
  /**
   * The onLocator callbacks that run when a particular locator is found
   * @type {LocatorCallbackContainer}
   */
  onLocatorCallbacks = [];

  /**
   * @constructor
   * @param {string[]} allowedDomains
   * @param {RegExp[]} disallowedFilters
   * @param {'chromium' | 'firefox' | 'webkit'} browserType
   * @param {{
   *    headless?: boolean
   *    rateLimit?: number
   *    depth?: number
   *    disableRoutes? : string | RegExp
   *    contextOptions?: import('playwright').BrowserContextOptions
   * }} options
   */
  constructor(
    allowedDomains,
    disallowedFilters,
    browserType,
    options = { headless: true, rateLimit: -Infinity, depth: 0 }
  ) {
    /**
     * @type {string[]}
     */
    this.allowedDomains = allowedDomains;
    /**
     * @type {RegExp[]}
     */
    this.disallowedFilters = disallowedFilters;
    /**
     * @type {'chromium' | 'firefox' | 'webkit'}
     */
    this.browserType = browserType;
    /**
     * @type {{
     *    headless?: boolean
     *    disableRoutes?: string | RegExp
     *    rateLimit?: number
     *    depth?: number
     *    contextOptions?: import('playwright').BrowserContextOptions
     * }}
     */
    this.options = options;
    /**+
     * @type {number}
     */
    this.currentDepth = 0;
  }

  /** Creates the Playwright context for Spamlet */
  async initContext() {
    this.port = await getNextOpenPort();
    /**
     * @type {import('playwright').LaunchOptions}
     */
    const launchOptions = {
      headless: this.options.headless,
      args: [`--remote-debugging-port=${this.port}`],
    };

    switch (this.browserType) {
      case "chromium":
        this.browser = await chromium.launch(launchOptions);
        break;
      case "firefox":
        this.browser = await firefox.launch(launchOptions);
        break;
      case "webkit":
        this.browser = await webkit.launch(launchOptions);
        break;
    }

    const context = await this.browser.newContext(this.options.contextOptions);
    if (this.options.disableRoutes)
      await context.route(this.options.disableRoutes, (route) => route.abort());
    this.context = context;
  }

  /**
   * initiates the crawl with the Spamlet
   * @example
   * // Starts crawl at 'https://www.example.com'
   * await spamlet.crawl('https://www.example.com')
   * @param {string} starterUrl
   */
  async crawl(starterUrl) {
    let numOfRequests = 0;

    let start = this.sanitizeLink(starterUrl);
    if (!start) {
      console.error(`Spamlet Error - Bad starter URL: ${starterUrl}`);
      return;
    }
    this.currentPage = new URL(starterUrl);
    await this.visitLink(start);

    let startTime = performance.now();
    while (this.cbStack.length) {
      let execFrame = this.cbStack.pop();
      this.currentPage = new URL(execFrame.url);
      switch (execFrame.type) {
        case "REQUEST":
          if (
            this.options.depth !== 0 &&
            execFrame.depth > this.options.depth
          ) {
            continue;
          }
          this.currentDepth = execFrame.depth;
          const page = await this.context.newPage();
          this.pageEvents && this.#attachPageEvents(page);
          this.activePage = page;
          if (await this.validateLink(page, execFrame.url)) {
            continue;
          }
          numOfRequests++;
          let timeToNow = performance.now() - startTime;
          let requestRate = numOfRequests / timeToNow;

          if (numOfRequests > 1 && requestRate >= 1 / this.options.rateLimit) {
            console.log("Rate Limiting...");
            await sleep(this.options.rateLimit);
          }
          await this.#visit(page, execFrame.url);
          break;
        case "RESPONSE":
          await this.#onPageResponseHandler(execFrame.res);
          break;
        default:
          console.error("Unhandled execution frame type:", execFrame);
          break;
      }
    }

    this.context.close();
    this.browser.close();
  }

  /**
   *
   * @param {import('playwright').Page} page
   * @param {string | URL} link
   */
  async #visit(page, link) {
    link = typeof link !== "string" ? link.toString() : link;
    const res = await page.goto(link);
    this.visitedUrls.add(link);

    this.cbStack.push({
      type: "RESPONSE",
      res,
    });

    //TODO: check for response
    if (!res?.ok()) {
      console.log("Page failed with status code:", res?.status());
      console.log("Headers:", await res?.allHeaders());
    } else {
      await this.#onPageLoadHandler(page);
      await this.#onSelectorHandler(page);
    }

    await page.close();
  }

  /**
   * Adds an href to the main callback stack.
   * @param {string} link
   */
  async visitLink(link) {
    this.cbStack.push({
      type: "REQUEST",
      url: link,
      depth: this.currentDepth + 1,
    });
  }

  /**
   * Internally used by Spamlet to check links before visiting. However, you can use it in hooks or events to validate links for your Spamlet model
   * @param {import("playwright").Page} page
   * @param {string | URL} link
   * @returns {Promise<boolean>}
   */
  async validateLink(page, link) {
    if (link instanceof URL) {
      link = link.toString();
    }

    let disallowed = false;
    for (let i = 0; i < this.disallowedFilters.length; i++) {
      disallowed = this.disallowedFilters[i].test(link);
      if (disallowed) {
        break;
      }
    }

    if (disallowed) {
      console.log(`DISALLOWED URL: ${link}`);
      await page.close();
      return true; //do nothing
    }
    if (this.visitedUrls.has(link)) {
      await page.close();
      return true; //do nothing
    }
    if (!link.includes(this.allowedDomains[0])) {
      console.log(`URL NOT ALLOWED: ${link}`);
      await page.close();
      return true; //do nothing
    }

    return false;
  }

  /**
   * Spamlet sanitization of hrefs to use before visiting a page
   * @param {string | URL} link
   * @param {string} origin
   * @returns {string | undefined}
   */
  sanitizeLink(link, origin = this.currentPage.origin) {
    if (link instanceof URL) {
      return link.toString();
    }
    try {
      // link is a full string url
      let value = new URL(link).toString();
      return value;
    } catch {
      if (link[0] === "/" || link[0] === "#" || link[0] === "?") {
        let value = origin + link;
        return new URL(value).toString();
      } else {
        console.error("Unhandled href type:", link);
        return;
      }
    }
  }

  /**
   * Adds a onSelector hook to Spamlet that runs when a selector is found on a page
   * @param {string} selector - A CSS selector
   * @param {SelectorCallback} cb
   */
  async onSelector(selector, cb) {
    this.onSelectorCallbacks.push({
      selector: selector,
      callback: cb,
    });
  }

  /**
   *
   * @param {import('playwright').Page} page
   */
  async #onSelectorHandler(page) {
    for (const { selector, callback } of this.onSelectorCallbacks) {
      const locs = page.locator(selector);
      for (const loc of await locs.all()) {
        await callback(loc);
      }
    }
  }

  /**
   *  Adds a onPageLoad callback hook that fires when a page loads. Compared to using Playwright's load event, this hook fires after the event happens.
   * @param {PageLoadCallback} cb
   */
  async onPageLoad(cb) {
    this.onPageLoadCallbacks.push({
      callback: cb,
    });
  }

  async #onPageLoadHandler(page) {
    for (const { callback } of this.onPageLoadCallbacks) {
      await callback(page);
    }
  }

  /**
   * Adds a onPageResponse callback hook that fires after Spamlet gets a page response.
   * Response hooks run only after a page closes. If you need to process a response immediately after it is retrieved, use the response Event.
   * @param {PageResponseCallback} cb
   */
  async onPageResponse(cb) {
    this.onPageResponseCallbacks.push({
      callback: cb,
    });
  }

  async #onPageResponseHandler(res) {
    for (const { callback } of this.onPageResponseCallbacks) {
      await callback(res);
    }
  }

  /**
   * @type {{
   *  event: PageEvents
   *  cb: (page: (import("playwright").Page)) => void
   * }[]}
   */
  pageEvents = [];
  /**
   *
   * @param {PageEvents} event
   * @param {(page:(import("playwright").Page)) => void} cb
   */
  addPageEvent(event, cb) {
    this.pageEvents.push({
      event,
      cb,
    });
  }

  /**
   *
   * @param {import("playwright").Page} page
   * @returns
   */
  #attachPageEvents(page) {
    for (const { event, cb } of this.pageEvents) {
      // @ts-ignore
      page.on(event, cb);
    }
    return page;
  }

  /**
   * @type {{
   *  event: ContextEvents,
   * cb: (context: (import('playwright').BrowserContext)) => void
   * }[]}
   */
  contextEvents = [];

  /**
   *
   * @param {ContextEvents} event
   * @param {(context: (import('playwright').BrowserContext)) => void} cb
   */
  addContextEvent(event, cb) {
    this.contextEvents.push({
      event,
      cb,
    });
  }

  /**
   *
   * @param {import("playwright").BrowserContext} context
   * @returns
   */
  #attachContextEvents(context) {
    for (const { event, cb } of this.contextEvents) {
      // @ts-ignore
      context.on(event, cb);
    }

    return context;
  }
}

/**
 * @typedef {"close"
 * | "console"
 * | "crash"
 * | "dialog"
 * | "domcontentloaded"
 * | "download"
 * | "filechooser"
 * | "frameattached"
 * | "framedetached"
 * | "framenavigated"
 * | "load"
 * | "pageerror"
 * | "popup"
 * | "request"
 * | "requestfailed"
 * | "requestfinished"
 * | "response"
 * | "websocket"
 * | "worker"} PageEvents
 */

/**
 * @typedef {"backgroundpage" | "close" | "console" | "dialog" | "page" | "request" | "requestfailed" | "requestfinished" | "response" | "serviceworker"} ContextEvents
 *
 */

/**
 * @typedef {function(import("playwright").Locator): Promise<void>} SelectorCallback
 */

/**
 * @typedef {function(import('playwright').Page):Promise<void>} PageLoadCallback
 */

/**
 * @typedef {function(import('playwright').Response): Promise<void>} PageResponseCallback
 */

/**
 * @typedef {function(import("playwright").Locator): Promise<void>} LocatorCallback
 */

/**
 * @typedef {{
 *locs: import('playwright').Locator;
 *callback: LocatorCallback;
 * }[]} LocatorCallbackContainer
 */

/**
 * @typedef {{
 * callback: PageResponseCallback;
 * }[]} PageResponseCallbackContainer
 */

/**
 * @typedef {{
 *  callback: PageLoadCallback;
 * }[]} PageLoadCallbackContainer
 */

/**
 * @typedef {{
 *  selector: string;
 *  callback: SelectorCallback
 * }[]} SelectorCallbackContainer
 */
