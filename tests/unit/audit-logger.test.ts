/**
 * tests/unit/audit-logger.test.ts
 *
 * Unit tests for centralized audit logger utility functions:
 * 1. Recursive scrubbing of sensitive credentials and secrets
 * 2. Payload size bounding to prevent unbounded storage bloat
 * 3. Client IP extraction from standard reverse-proxy headers
 */

import { scrubMetadata, boundMetadata, extractClientIp } from "../../src/lib/audit/logger";

describe("Audit Logger Unit Tests", () => {
  describe("scrubMetadata", () => {
    it("redacts sensitive fields like passwords, tokens, secrets, and auth headers", () => {
      const input = {
        username: "johndoe",
        password: "SuperSecretPassword123!",
        user_token: "jwt.token.here",
        api_key: "sk-live-12345",
        authorization: "Bearer secret-bearer",
        session_cookie: "sess=abc",
        credential_hash: "$2b$10$abcdef",
        safeField: "safe value",
        nested: {
          admin_secret: "hidden",
          nestedSafe: 42,
        },
      };

      const result = scrubMetadata(input) as Record<string, unknown>;

      expect(result.username).toBe("johndoe");
      expect(result.password).toBe("[REDACTED]");
      expect(result.user_token).toBe("[REDACTED]");
      expect(result.api_key).toBe("[REDACTED]");
      expect(result.authorization).toBe("[REDACTED]");
      expect(result.session_cookie).toBe("[REDACTED]");
      expect(result.credential_hash).toBe("[REDACTED]");
      expect(result.safeField).toBe("safe value");
      expect((result.nested as any).admin_secret).toBe("[REDACTED]");
      expect((result.nested as any).nestedSafe).toBe(42);
    });

    it("handles arrays and scrubs sensitive elements inside objects in arrays", () => {
      const input = [
        { name: "item1", secret_key: "xyz" },
        { name: "item2", token: "123" },
      ];

      const result = scrubMetadata(input) as any[];

      expect(result[0].name).toBe("item1");
      expect(result[0].secret_key).toBe("[REDACTED]");
      expect(result[1].name).toBe("item2");
      expect(result[1].token).toBe("[REDACTED]");
    });

    it("handles primitives and null/undefined values safely", () => {
      expect(scrubMetadata(null)).toBeNull();
      expect(scrubMetadata(undefined)).toBeUndefined();
      expect(scrubMetadata("string")).toBe("string");
      expect(scrubMetadata(123)).toBe(123);
      expect(scrubMetadata(true)).toBe(true);
    });
  });

  describe("boundMetadata", () => {
    it("returns clean scrubbed metadata when payload is within bounded size", () => {
      const metadata = { action: "update", details: "normal payload" };
      const bounded = boundMetadata(metadata);
      expect(bounded).toEqual(metadata);
    });

    it("truncates payloads that exceed the maxBytes threshold", () => {
      const hugeString = "a".repeat(10000);
      const hugeMetadata = { largeContent: hugeString };

      const bounded = boundMetadata(hugeMetadata, 5000);

      expect(bounded._truncated).toBe(true);
      expect(typeof bounded._original_byte_length).toBe("number");
      expect(typeof bounded.preview).toBe("string");
    });
  });

  describe("extractClientIp", () => {
    it("extracts the first IP from x-forwarded-for header", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      });
      expect(extractClientIp(headers)).toBe("203.0.113.195");
    });

    it("falls back to x-real-ip if x-forwarded-for is missing", () => {
      const headers = new Headers({
        "x-real-ip": "198.51.100.1",
      });
      expect(extractClientIp(headers)).toBe("198.51.100.1");
    });

    it("falls back to cf-connecting-ip if others are missing", () => {
      const headers = new Headers({
        "cf-connecting-ip": "198.51.100.24",
      });
      expect(extractClientIp(headers)).toBe("198.51.100.24");
    });

    it("returns null if no IP headers are present or req is null", () => {
      expect(extractClientIp(null)).toBeNull();
      expect(extractClientIp(new Headers())).toBeNull();
    });
  });
});
