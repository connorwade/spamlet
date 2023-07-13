/**
 *
 * @param {number} ms
 * @returns {Promise<any>}
 */
export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
