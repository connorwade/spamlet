import Crawler from "../src/index.js";

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Crawler(["localhost:5173"], disallowedFilters, "chromium", {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 10 * 1000,
});

crawler.onLocator(crawler.activePage!.getByRole("link")!, async (loc) => {
  const href = (await loc.getAttribute("href")) ?? "";
  const origin = loc.page().url();
  const link = crawler.sanitizeLink(href, origin);
  link && (await crawler.visitLink(link));
});

crawler.context?.on("page", async (page) => {
  console.log("URL:", page.url());
});

await crawler.crawl(starterUrl);
