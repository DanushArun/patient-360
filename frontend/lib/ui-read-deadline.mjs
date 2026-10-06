/** @template T @param {Promise<T>} read @param {number} milliseconds @returns {Promise<T>} */
// Live Snowflake session setup and scoped reads exceeded eight seconds in the
// target account. Keep an outage bound without rejecting healthy cold reads.
export async function withUiReadDeadline(read, milliseconds = 30000) {
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('ui_read_timeout')), milliseconds);
  });
  try {
    return await Promise.race([read, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
