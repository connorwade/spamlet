import Spamlet from "../src/index.js"; // "spamlet"

const starterUrl = "http://localhost:5173";
const disallowedFilters = [/.*\?.*/gm, /#.*/gm];
const crawler = new Spamlet(["localhost:5173"], disallowedFilters, "chromium", {
  headless: false,
  disableRoutes: "**.{png, jpeg, jpg, webm, svg}",
  rateLimit: 1 * 10 * 1000,
});

crawler.context?.on("page", async (page) => {
  console.log("URL:", page.url());
});

await crawler.crawl(starterUrl);
