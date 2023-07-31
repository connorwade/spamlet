import * as net from "node:net";

/**
 *
 * @param {number} port
 * @returns {Promise<boolean>}
 */
export const isPortOpen = async (port) => {
  return new Promise((resolve, reject) => {
    let server = net.createServer();
    server.once("error", (err) => {
      resolve(err["code"] !== "EADRINUSE");
    });
    server.once("listening", () => {
      resolve(true);
      server.close();
    });
    server.listen(port);
  });
};

/**
 *
 * @param {number} startFrom
 * @returns {Promise<number>}
 */
export const getNextOpenPort = async (startFrom = 2222) => {
  let openPort = null;
  while (startFrom < 65535 || !!openPort) {
    if (await isPortOpen(startFrom)) {
      openPort = startFrom;
      break;
    }
    startFrom++;
  }
  return openPort;
};
