/** @template T @param {Promise<T>} read @param {number} milliseconds @returns {Promise<T>} */
export async function withUiReadDeadline(read, milliseconds = 8000) {
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
