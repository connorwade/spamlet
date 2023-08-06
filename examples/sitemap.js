import Spamlet from "spamlet";

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Spamlet(["localhost:5173"], disallowedFilters, "chromium", {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 1 * 1000,
  depth: 3,
});
const sitemap = [];

await crawler.initContext();

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
