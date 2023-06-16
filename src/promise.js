export function delay(delay) { return value => new Promise(resolve => setTimeout(resolve, delay, value)); }

export function pause(ms, value) { return delay(ms)(value); }

export function wait(ms) { return () => pause(ms); }

export function log(...args) { return new Promise(resolve => {
  console.log(...args);
  resolve();
});   }
