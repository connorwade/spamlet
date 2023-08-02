import Spamlet from "../src/index.js";

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Spamlet(["localhost:5173"], disallowedFilters, "chromium", {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 1 * 1000,
});

await crawler.initContext();

crawler.onSelector("a[href]", async (loc) => {
  const href = (await loc.getAttribute("href")) ?? "";
  const origin = loc.page().url();
  const link = crawler.sanitizeLink(href, origin);
  link && (await crawler.visitLink(link));
});

crawler.context.on("request", (req) => {
  console.log("Page Request:", req.url());
});

crawler.addPageEvent("load", (page) => {
  console.log("Looking at page:", page.url());
});

await crawler.crawl(starterUrl);
