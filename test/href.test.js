import { describe, it } from "node:test";
import assert from "node:assert";

const starterUrl = `https://www.example.com`;

describe("Sanitize Link Module", () => {
  it("Link is a URL", async () => {
    const url = new URL("https://www.example.com");
    const link = sanitizeLink(url);
    assert.equal(link instanceof URL, true);
  });

  it("Link is url string", async () => {
    const url = "https://www.example.com";
    const link = sanitizeLink(url);
    assert.equal(link instanceof URL, true);
  });

  it("Link is a /", async () => {
    const url = "/about";
    const link = sanitizeLink(url);
    assert.equal(link instanceof URL, true);
  });
});
