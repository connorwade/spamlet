## Beta - Expect API changes

# Spamlet

Spamlet is a simple and efficient crawler plugin for Playwright.

Compatible with TypeScript, Module JS, and Common JS.

## Install

Spamlet requires Playwright as a dependency. 

```bash
npm -i playwright spamlet
```

### Importing to a project

#### Commonjs
```JS
const Spamlet = require("spamlet").default;
```

#### JS Modules & TypeScript
```JS
import Spamlet from "spamlet";
```

## Initializing a crawler

To start a crawler import the Spamlet class.

```JS
import Spamlet from "spamlet";

const starterUrl = "https://<domain>"
const disallowedFilters = [<"Any Regex pattern you want">\]
const crawler = new Spamlet([<allowed domains>], disallowedFilters, <browsertype> {
  headless: <boolean>,
  rateLimit: <number>,
  disableRoutes: <string | regex>,
  contextOptions: <Playwright browser context options>,
})

await crawler.initContext()

await crawler.crawl(starterUrl)
```

## Using Crawler Hooks

Spamlet has a few API's to make crawling easier.

- `onSelector` - takes a selector and defines actions the crawler performs on the page
- `onPageLoad` - defines actions for the crawler to take when a page loads
- `onPageResponse` - defines actions for the crawler to take when response data is returned

```JS
crawler.onPageResponse(async (res) => {
  console.log(res.url());
});

crawler.onSelector("a[href]", async (loc) => {
  const href = await loc.getAttribute("href");
  const origin = loc.page().url();
  const link = crawler.sanitizeLink(href, origin);
  await crawler.visitLink(link);
});

crawler.onPageLoad(async (page) => {
  sitemap.push(page.url());
});
```

## Using Playwright Events

Spamlet can use Playwright's events.

Page events have to be registered using `addPageEvent`. Page events using this method will attach to the page right after context creation but before the page navigates to the url.

```JS
crawler.addPageEvent("load", (page) => {
  console.log("Looking at page:", page.url());
});
```

You could attach them after page load using the `onPageLoad` hook if timing isn't important.

Context events should be registered only after initializing the context.

```JS
await crawler.initContext();

crawler.context.on("request", (req) => {
  console.log("Page Request:", req.url());
});
```

This may change in the future to match the `addPageEvent` method.

### Example

See the `/examples` folder for more demos.

```JS
import Spamlet from "spamlet";

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Spamlet(["localhost:5173"], disallowedFilters, "chromium", {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 1 * 1000,
});
const sitemap = [];

crawler.initContext();

crawler.onPageResponse(async (res) => {
  console.log(res.url());
});

crawler.onSelector("a[href]", async (loc) => {
  const href = await loc.getAttribute("href");
  const origin = loc.page().url();
  const link = crawler.sanitizeLink(href, origin);
  await crawler.visitLink(link);
});

crawler.onPageLoad(async (page) => {
  sitemap.push(page.url());
});

await crawler.crawl(starterUrl);
console.log(sitemap);
```