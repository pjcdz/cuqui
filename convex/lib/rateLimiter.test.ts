import { describe, it, expect, beforeEach } from "vitest";
import {
  RateLimitTracker,
  checkRateLimit,
  DEFAULT_RATE_LIMIT,
  WINDOW_DURATION_MS,
  RATE_LIMIT_ERROR_MESSAGE,
  getRateLimitTracker,
} from "./rateLimiter";

// ============================================================================
// VAL-RATE-001: Rate limiter enforces 100 req/min
// ============================================================================

describe("VAL-RATE-001: Rate limiter enforces limit per minute", () => {
  let tracker: RateLimitTracker;

  beforeEach(() => {
    tracker = new RateLimitTracker(100, 60_000);
  });

  it("allows calls under the limit", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Make 99 calls — all should be allowed
    for (let i = 0; i < 99; i++) {
      const result = tracker.check(userId, baseTime + i);
      expect(result.allowed).toBe(true);
    }
  });

  it("allows exactly the limit number of calls", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Make exactly 100 calls — all should be allowed
    for (let i = 0; i < 100; i++) {
      const result = tracker.check(userId, baseTime + i);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects calls over the limit within the same window", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      tracker.check(userId, baseTime + i);
    }

    // 101st call should be rejected
    const result = tracker.check(userId, baseTime + 100);
    expect(result.allowed).toBe(false);
  });

  it("provides retryAfterMs when rate limit exceeded", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Exhaust the limit
    for (let i = 0; i < 100; i++) {
      tracker.check(userId, baseTime);
    }

    const result = tracker.check(userId, baseTime + 1000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("allows calls again after the window expires", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Exhaust the limit at baseTime
    for (let i = 0; i < 100; i++) {
      tracker.check(userId, baseTime + i);
    }

    // After the window expires (60s later), calls should be allowed again
    const newWindowTime = baseTime + 60_001;
    const result = tracker.check(userId, newWindowTime);
    expect(result.allowed).toBe(true);
  });

  it("uses a sliding window — old calls expire individually", () => {
    const userId = "user_a";
    const baseTime = 1_000_000;

    // Make 100 calls spread over 30 seconds
    for (let i = 0; i < 100; i++) {
      tracker.check(userId, baseTime + i * 300); // 0 to 29.7s
    }

    // At baseTime + 60_300, the call at baseTime + 0 has expired (60.3s ago)
    // So 99 calls remain in window, allowing 1 more call
    const result = tracker.check(userId, baseTime + 60_300);
    expect(result.allowed).toBe(true); // 99 in window + this call = 100

    // At baseTime + 60_600, the call at baseTime + 300 has expired (60.3s ago)
    // 98 calls remain in window, allowing 2 more calls
    const result2 = tracker.check(userId, baseTime + 60_600);
    expect(result2.allowed).toBe(true);

    // After enough time passes that all 102 recorded calls are outside window,
    // we should have a fresh limit
    // Last recorded call was at baseTime + 60_600
    // At baseTime + 120_700, everything is >60s ago
    const result3 = tracker.check(userId, baseTime + 120_700);
    expect(result3.allowed).toBe(true);
  });

  it("default limit is 100", () => {
    expect(DEFAULT_RATE_LIMIT).toBe(100);
  });

  it("default window is 60 seconds", () => {
    expect(WINDOW_DURATION_MS).toBe(60_000);
  });
});

// ============================================================================
// VAL-RATE-002: Rate limit is per-user
// ============================================================================

describe("VAL-RATE-002: Rate limit is per-user (independent limits)", () => {
  let tracker: RateLimitTracker;

  beforeEach(() => {
    tracker = new RateLimitTracker(100, 60_000);
  });

  it("user A exhausting their limit does not affect user B", () => {
    const userA = "provider_a";
    const userB = "provider_b";
    const baseTime = 1_000_000;

    // User A exhausts their 100 req/min limit
    for (let i = 0; i < 100; i++) {
      const result = tracker.check(userA, baseTime + i);
      expect(result.allowed).toBe(true);
    }

    // User A is now blocked
    const resultA = tracker.check(userA, baseTime + 100);
    expect(resultA.allowed).toBe(false);

    // User B can still make calls
    const resultB = tracker.check(userB, baseTime + 100);
    expect(resultB.allowed).toBe(true);
  });

  it("user B can exhaust their full limit independently", () => {
    const userA = "provider_a";
    const userB = "provider_b";
    const baseTime = 1_000_000;

    // User A exhausts their limit
    for (let i = 0; i < 100; i++) {
      tracker.check(userA, baseTime + i);
    }

    // User B should be able to make all 100 calls
    for (let i = 0; i < 100; i++) {
      const result = tracker.check(userB, baseTime + 100 + i);
      expect(result.allowed).toBe(true);
    }

    // User B is now also blocked
    const resultB = tracker.check(userB, baseTime + 201);
    expect(resultB.allowed).toBe(false);
  });

  it("rate limit state is isolated per user identity", () => {
    const users = ["user_1", "user_2", "user_3"];
    const baseTime = 1_000_000;

    // Each user should be able to make 100 calls independently
    for (const user of users) {
      for (let i = 0; i < 100; i++) {
        const result = tracker.check(user, baseTime + i);
        expect(result.allowed).toBe(true);
      }
    }

    // All users should now be blocked
    for (const user of users) {
      const result = tracker.check(user, baseTime + 100);
      expect(result.allowed).toBe(false);
    }
  });

  it("different users have independent windows", () => {
    const userA = "provider_a";
    const userB = "provider_b";
    const baseTime = 1_000_000;

    // User A makes calls at time 0
    for (let i = 0; i < 100; i++) {
      tracker.check(userA, baseTime + i);
    }

    // User B makes calls 60s later (different window entirely)
    for (let i = 0; i < 100; i++) {
      const result = tracker.check(userB, baseTime + 60_000 + i);
      expect(result.allowed).toBe(true);
    }

    // User A's window resets at baseTime + 60_001
    const resultA = tracker.check(userA, baseTime + 60_001);
    expect(resultA.allowed).toBe(true);
  });
});

// ============================================================================
// RateLimitTracker unit tests
// ============================================================================

describe("RateLimitTracker", () => {
  it("supports custom limit", () => {
    const tracker = new RateLimitTracker(5, 60_000);
    expect(tracker.getLimit()).toBe(5);
  });

  it("supports custom window duration", () => {
    const tracker = new RateLimitTracker(100, 30_000);
    expect(tracker.getWindowMs()).toBe(30_000);
  });

  it("getCount returns current call count within window", () => {
    const tracker = new RateLimitTracker(10, 60_000);
    const userId = "user1";
    const baseTime = 1_000_000;

    for (let i = 0; i < 5; i++) {
      tracker.check(userId, baseTime + i);
    }

    expect(tracker.getCount(userId, baseTime + 4)).toBe(5);
  });

  it("getCount excludes calls outside window", () => {
    const tracker = new RateLimitTracker(10, 1_000); // 1 second window
    const userId = "user1";
    const baseTime = 1_000_000;

    tracker.check(userId, baseTime);
    tracker.check(userId, baseTime + 500);

    // At baseTime + 1001, the first call is outside the 1s window
    expect(tracker.getCount(userId, baseTime + 1_001)).toBe(1);
  });

  it("reset clears all tracked calls", () => {
    const tracker = new RateLimitTracker(10, 60_000);
    const userId = "user1";

    tracker.check(userId);
    tracker.check(userId);
    tracker.reset();

    expect(tracker.getCount(userId)).toBe(0);
  });
});

// ============================================================================
// checkRateLimit function tests
// ============================================================================

describe("checkRateLimit function", () => {
  it("does not throw when under limit", () => {
    const tracker = new RateLimitTracker(100, 60_000);
    expect(() => checkRateLimit({}, "user1", 100, tracker)).not.toThrow();
  });

  it("throws error with rate limit message when over limit", () => {
    const tracker = new RateLimitTracker(3, 60_000);
    const userId = "user1";

    // Exhaust the limit
    checkRateLimit({}, userId, 3, tracker);
    checkRateLimit({}, userId, 3, tracker);
    checkRateLimit({}, userId, 3, tracker);

    // 4th call should throw
    expect(() => checkRateLimit({}, userId, 3, tracker)).toThrow(RATE_LIMIT_ERROR_MESSAGE);
  });

  it("error message clearly indicates rate limiting", () => {
    const tracker = new RateLimitTracker(1, 60_000);
    checkRateLimit({}, "user1", 1, tracker);

    try {
      checkRateLimit({}, "user1", 1, tracker);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      const message = (error as Error).message;
      // Must contain rate-limit related words
      expect(message).toMatch(/rate.?limit/i);
    }
  });

  it("error message is not a generic error", () => {
    const tracker = new RateLimitTracker(1, 60_000);
    checkRateLimit({}, "user1", 1, tracker);

    try {
      checkRateLimit({}, "user1", 1, tracker);
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      const message = (error as Error).message;
      // Should NOT be a generic "An error occurred" or "Error"
      expect(message).not.toBe("Error");
      expect(message.length).toBeGreaterThan(10);
      expect(message).toContain("Rate limit");
    }
  });

  it("different users have independent rate limits via checkRateLimit", () => {
    const tracker = new RateLimitTracker(2, 60_000);

    // User A exhausts limit
    checkRateLimit({}, "userA", 2, tracker);
    checkRateLimit({}, "userA", 2, tracker);

    // User A is blocked
    expect(() => checkRateLimit({}, "userA", 2, tracker)).toThrow();

    // User B is not blocked
    expect(() => checkRateLimit({}, "userB", 2, tracker)).not.toThrow();
  });
});

// ============================================================================
// getRateLimitTracker singleton
// ============================================================================

describe("getRateLimitTracker", () => {
  it("returns a RateLimitTracker instance", () => {
    const tracker = getRateLimitTracker();
    expect(tracker).toBeInstanceOf(RateLimitTracker);
  });

  it("has the default limit of 100", () => {
    const tracker = getRateLimitTracker();
    expect(tracker.getLimit()).toBe(100);
  });

  it("has the default window of 60000ms", () => {
    const tracker = getRateLimitTracker();
    expect(tracker.getWindowMs()).toBe(60_000);
  });
});
