import Crawler from "../src/index.js";

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Crawler(["localhost:5173"], disallowedFilters, {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 10 * 1000,
});
const sitemap = [];

crawler.onLocator("a[href]", async (loc) => {
  const href = await loc.getAttribute("href");
  const origin = loc.page().url();
  const link = crawler.sanitizeLink(href, origin);
  await crawler.visitLink(link);
});

crawler.onPageResponse(async (res) => {
  console.log(res.url());
});

crawler.onPageLoad(async (page) => {
  sitemap.push(page.url());
});

async function dev() {
  await crawler.crawl(starterUrl);
}

dev().finally(() => {
  console.log(sitemap);
  process.exit(1);
});
