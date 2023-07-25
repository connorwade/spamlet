import { chromium } from "playwright";
import { getNextOpenPort } from "./getPort.js";
import { sleep } from "./utils.js";

/**
 * Create a new Crawler object
 * @class
 */
export default class Crawler {
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
   * @type {import("./types.js").LocatorCallbackContainer}
   */
  onLocatorCallbacks;
  /**
   * @type {import("./types.js").PageLoadCallbackContainer}
   */
  onPageLoadCallbacks;
  /**
   * @type {import("./types.js").PageResponseCallbackContainer}
   */
  onPageResponseCallbacks;

  /**
   * @param {string[]} allowedDomains
   * @param {RegExp[]} disallowedFilters
   * @param {{
   *    https?: boolean
   *    headless?: boolean
   *    rateLimit?: number
   *    disableRoutes?: string | RegExp | ((url: URL) => boolean)
   * }} opts
   */

  constructor(
    allowedDomains,
    disallowedFilters,
    opts = { headless: true, rateLimit: -Infinity }
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
     * @type {{
     *    https?: boolean
     *    headless?: boolean
     *    rateLimit?: number
     *    disableRoutes?: string | RegExp | ((url: URL) => boolean)
     * }}
     */
    this.opts = opts;
  }

  async #initContext() {
    this.port = await getNextOpenPort();
    /**
     * @type {import('playwright').LaunchOptions}
     */
    const chromiumLaunchOptions = {
      headless: this.opts.headless,
      args: [`--remote-debugging-port=${this.port}`],
    };
    this.browser = await chromium.launch(chromiumLaunchOptions);
    const context = await this.browser.newContext();
    if (this.opts.disableRoutes)
      await context.route(this.opts.disableRoutes, (route) => route.abort());
    return context;
  }

  /**
   * initiates the crawl with the crawler
   * @param {string} starterUrl
   */
  async crawl(starterUrl) {
    let numOfRequests = 0;
    const context = await this.#initContext();

    await this.visitLink(starterUrl + "/");

    let startTime = performance.now();
    while (this.cbStack.length) {
      let execFrame = this.cbStack.pop();
      switch (execFrame.type) {
        case "REQUEST":
          const page = await context.newPage();
          if (await this.validateLink(page, execFrame.url)) {
            continue;
          }
          numOfRequests++;
          let timeToNow = performance.now() - startTime;
          let requestRate = numOfRequests / timeToNow;

          if (numOfRequests > 1 && requestRate >= 1 / this.opts.rateLimit) {
            console.log("Rate Limiting...");
            await sleep(this.opts.rateLimit);
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

    context.close();
    this.browser.close();
  }

  //TODO: Maybe make private and rename
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
      await this.#onLocatorHandler(page);
    }

    await page.close();
  }

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
   * @param {import("./types.js").LocatorCallback} cb
   */
  async onLocator(selector, cb) {
    this.onLocatorCallbacks.push({
      selector: selector,
      callback: cb,
    });
  }

  /**
   *
   * @param {import('playwright').Page} page
   */
  async #onLocatorHandler(page) {
    for (const { selector, callback } of this.onLocatorCallbacks) {
      const locs = page.locator(selector);
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
}
