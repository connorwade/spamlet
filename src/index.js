import { chromium, firefox, webkit } from "playwright";
import { getNextOpenPort } from "./getPort.js";
import { sleep } from "./utils.js";

/**
 * Create a new Spamlet object
 * @class
 */
export default class Spamlet {
  /**
   * @type {Set<string>}
   */
  visitedUrls = new Set();
  /**
   * @type {{
   * type: string,
   * url?: URL | string,
   * base?: URL |string,
   * res?: import('playwright').Response}[]
   * }
   */
  cbStack = [];
  /**
   * @type {string | number}
   */
  port;

  /**
   * @type {import("./types.js").SelectorCallbackContainer}
   */
  onSelectorCallbacks = [];
  /**
   * @type {import("./types.js").PageLoadCallbackContainer}
   */
  onPageLoadCallbacks = [];
  /**
   * @type {import("./types.js").PageResponseCallbackContainer}
   */
  onPageResponseCallbacks = [];
  /**
   * @type {import("./types.js").LocatorCallbackContainer}
   */
  onLocatorCallbacks = [];

  /**
   * @param {string[]} allowedDomains
   * @param {RegExp[]} disallowedFilters
   * @param {'chromium' | 'firefox' | 'webkit'} browserType
   * @param {{
   *    headless?: boolean
   *    rateLimit?: number
   *    disableRoutes? : string | RegExp
   *    contextOptions?: import('playwright').BrowserContextOptions
   * }} options
   */

  constructor(
    allowedDomains,
    disallowedFilters,
    browserType,
    options = { headless: true, rateLimit: -Infinity }
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
     *    contextOptions?: import('playwright').BrowserContextOptions
     * }}
     */
    this.options = options;
  }

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
   * @param {string} starterUrl
   */
  async crawl(starterUrl) {
    let numOfRequests = 0;

    let start = this.sanitizeLink(starterUrl);
    await this.visitLink(start);

    let startTime = performance.now();
    while (this.cbStack.length) {
      let execFrame = this.cbStack.pop();
      switch (execFrame.type) {
        case "REQUEST":
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
      await this.#onLocatorHandler(page);
    }

    await page.close();
  }

  /**
   *
   * @param {string} link
   */
  async visitLink(link) {
    this.cbStack.push({
      type: "REQUEST",
      url: link,
    });
  }

  async validateLink(page, link) {
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
   *
   * @param {string | URL} link
   * @returns
   */
  sanitizeLink(link, origin) {
    if (link instanceof URL) {
      return link.toString();
    }
    try {
      // link is a full string url
      let value = new URL(link).toString();
      return value;
    } catch {
      let originUrl = new URL(origin);
      let originBase = originUrl.origin;
      if (link[0] === "/" || link[0] === "#" || link[0] === "?") {
        let value = originBase + link;
        return new URL(value).toString();
      } else {
        console.error("Unhandled href type:", link);
        return;
      }
    }
  }

  /**
   *
   * @param {string} selector
   * @param {import("./types.js").SelectorCallback} cb
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
   *
   * @param {import('playwright').Locator} loc
   * @param {import("./types.js").LocatorCallback} cb
   */
  async onLocator(loc, cb) {
    this.onLocatorCallbacks.push({
      locs: loc,
      callback: cb,
    });
  }

  /**
   *
   * @param {import('playwright').Page} page
   */
  async #onLocatorHandler(page) {
    for (const { locs, callback } of this.onLocatorCallbacks) {
      for (const loc of await locs.all()) {
        await callback(loc);
      }
    }
  }

  /**
   *
   * @param {import("./types.js").PageLoadCallback} cb
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
   *
   * @param {import("./types.js").PageResponseCallback} cb
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
   *  event: import('./types.js').PageEvents
   *  cb: (page: (import("playwright").Page)) => void
   * }[]}
   */
  pageEvents = [];
  /**
   *
   * @param {import('./types.js').PageEvents} event
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
}
