// src/utils/withTimeout.ts
// Hard upper limit for any async step — guarantees loaders/spinners always end.

export const REQUEST_TIMEOUT_MS = 30000;

export const TIMEOUT_MSG = 'Server is taking too long to respond. Please check your internet and try again.';
export const NETWORK_MSG = 'No internet connection. Please check your network and try again.';

export const withTimeout = <T,>(promise: Promise<T>, ms: number, message = TIMEOUT_MSG): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(message), { isTimeout: true })), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
