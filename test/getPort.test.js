import { describe } from "@jest/globals";
import { test, expect } from "@jest/globals";
import * as net from "node:http";
import { isPortOpen, getNextOpenPort } from "../src/getPort";

describe("Open Port functions", () => {
  test("Is Port Open", async () => {
    let port = 9901;
    let server = net.createServer();
    server.once("listening", async () => {
      let isOpen = await isPortOpen(port);
      expect(!isOpen);
      isOpen = await isPortOpen(port + 1);
      expect(isOpen);
      server.close();
    });
    server.listen(port);
  });

  test("Get Next Port", async () => {
    let port = await getNextOpenPort();
    expect(port);
    let isOpen = await isPortOpen(port);
    expect(isOpen);
  });
});
