import { withRetry } from '../src/api/retry';
import { ApiError } from '../src/api/client';

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const op = jest.fn(async () => 'ok');
    await expect(withRetry('t', op, { baseDelayMs: 1 })).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and eventually succeeds', async () => {
    let calls = 0;
    const op = jest.fn(async () => {
      calls += 1;
      if (calls < 3) throw new TypeError('Network request failed');
      return 'recovered';
    });
    await expect(withRetry('t', op, { attempts: 4, baseDelayMs: 1 })).resolves.toBe('recovered');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable 4xx errors', async () => {
    const op = jest.fn(async () => {
      throw new ApiError(404, 'not_found', 'not found');
    });
    await expect(withRetry('t', op, { attempts: 4, baseDelayMs: 1 })).rejects.toThrow('not found');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries 5xx errors up to the attempt limit', async () => {
    const op = jest.fn(async () => {
      throw new ApiError(503, 'unavailable', 'unavailable');
    });
    await expect(withRetry('t', op, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow('unavailable');
    expect(op).toHaveBeenCalledTimes(3);
  });
});
