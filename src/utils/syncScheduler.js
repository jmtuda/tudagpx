// Keep local persistence immediate; coalesce only remote snapshots.
export function createSyncScheduler(
  save,
  { delay = 3000, maxWait = 15000, timers = globalThis } = {},
) {
  let pending = null;
  let waiters = [];
  let debounce = null;
  let deadline = null;
  let running = false;
  let due = false;
  function clearTimers() {
    timers.clearTimeout(debounce);
    timers.clearTimeout(deadline);
    debounce = deadline = null;
  }
  async function flush() {
    if (running) {
      due = true;
      return;
    }
    if (!pending) return;
    clearTimers();
    const data = pending;
    const batch = waiters;
    pending = null;
    waiters = [];
    due = false;
    running = true;
    try {
      await save(data);
      batch.forEach(({ resolve }) => resolve());
    } catch (error) {
      batch.forEach(({ reject }) => reject(error));
    } finally {
      running = false;
      if (due && pending) void flush();
    }
  }
  return {
    schedule(data) {
      pending = data;
      timers.clearTimeout(debounce);
      debounce = timers.setTimeout(flush, delay);
      if (deadline === null) deadline = timers.setTimeout(flush, maxWait);
      return new Promise((resolve, reject) =>
        waiters.push({ resolve, reject }),
      );
    },
    flush,
  };
}
