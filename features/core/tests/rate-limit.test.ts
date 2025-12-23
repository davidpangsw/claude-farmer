/**
 * Unit tests for rate limit handling and exponential backoff behavior.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { patch } from "../commands/patch/index.js";
import { develop } from "../commands/develop/index.js";
import type { AIModel } from "../types.js";

describe("rate limit handling", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "rate-limit-test-"));

    await mkdir(join(tempDir, "claude-farmer", "docs"), { recursive: true });
    await writeFile(
      join(tempDir, "claude-farmer", "GOAL.md"),
      "# Goal\n\nTest goal."
    );
    await writeFile(join(tempDir, "index.ts"), "export const x = 1;");
  });

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("develop command", () => {
    it("retries with exponential backoff on spending cap error", async () => {
      let callCount = 0;
      const sleepDurations: number[] = [];

      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            throw new Error("Spending cap reached for this billing period");
          }
          // Return edits on third call to exit loop
          return [{ path: "test.ts", content: "done" }];
        }),
      };

      const mockSleep = vi.fn().mockImplementation((ms: number) => {
        sleepDurations.push(ms);
        return Promise.resolve();
      });

      await develop(tempDir, mockAI, {
        once: false,
        _sleepFn: mockSleep,
      });

      // Should have called generateEdits 3 times (2 failures + 1 success)
      expect(callCount).toBe(3);

      // Should have slept twice with exponential backoff
      expect(sleepDurations.length).toBe(2);
      expect(sleepDurations[0]).toBe(60 * 1000); // 1 minute
      expect(sleepDurations[1]).toBe(2 * 60 * 1000); // 2 minutes
    });

    it("retries with exponential backoff on hit your limit error", async () => {
      let callCount = 0;
      const sleepDurations: number[] = [];

      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error("You've hit your limit for this month");
          }
          return [{ path: "test.ts", content: "done" }];
        }),
      };

      const mockSleep = vi.fn().mockImplementation((ms: number) => {
        sleepDurations.push(ms);
        return Promise.resolve();
      });

      await develop(tempDir, mockAI, {
        once: false,
        _sleepFn: mockSleep,
      });

      expect(callCount).toBe(2);
      expect(sleepDurations.length).toBe(1);
      expect(sleepDurations[0]).toBe(60 * 1000);
    });

    it("throws non-rate-limit errors immediately", async () => {
      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockRejectedValue(new Error("Network error")),
      };

      const mockSleep = vi.fn();

      await expect(
        develop(tempDir, mockAI, {
          once: true,
          _sleepFn: mockSleep,
        })
      ).rejects.toThrow("Network error");

      // Should not have slept
      expect(mockSleep).not.toHaveBeenCalled();
    });

    it("applies backoff when no changes in loop mode", async () => {
      let callCount = 0;
      const sleepDurations: number[] = [];

      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount <= 2) {
            return []; // No edits
          }
          return [{ path: "test.ts", content: "done" }];
        }),
      };

      const mockSleep = vi.fn().mockImplementation((ms: number) => {
        sleepDurations.push(ms);
        return Promise.resolve();
      });

      await develop(tempDir, mockAI, {
        once: false,
        _sleepFn: mockSleep,
      });

      expect(callCount).toBe(3);
      expect(sleepDurations.length).toBe(2);
      expect(sleepDurations[0]).toBe(60 * 1000);
      expect(sleepDurations[1]).toBe(2 * 60 * 1000);
    });

    it("resets backoff after successful edits", async () => {
      let callCount = 0;
      const sleepDurations: number[] = [];

      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return []; // No edits - triggers backoff
          if (callCount === 2) return [{ path: "a.ts", content: "a" }]; // Success - resets backoff
          if (callCount === 3) return []; // No edits again - should use reset backoff
          return [{ path: "b.ts", content: "b" }]; // Final success
        }),
      };

      const mockSleep = vi.fn().mockImplementation((ms: number) => {
        sleepDurations.push(ms);
        return Promise.resolve();
      });

      await develop(tempDir, mockAI, {
        once: false,
        _sleepFn: mockSleep,
      });

      expect(callCount).toBe(4);
      expect(sleepDurations.length).toBe(2);
      // First backoff
      expect(sleepDurations[0]).toBe(60 * 1000);
      // After success, backoff resets, so second backoff also starts at 1 min
      expect(sleepDurations[1]).toBe(60 * 1000);
    });
  });

  describe("exponential backoff limits", () => {
    it("caps backoff at 2 hours", async () => {
      let callCount = 0;
      const sleepDurations: number[] = [];
      const MAX_SLEEP_MS = 2 * 60 * 60 * 1000; // 2 hours

      const mockAI: AIModel = {
        generateReview: vi.fn().mockResolvedValue(""),
        generateEdits: vi.fn().mockImplementation(() => {
          callCount++;
          // Return empty for first 10 calls, then return edits
          if (callCount <= 10) {
            return [];
          }
          return [{ path: "test.ts", content: "done" }];
        }),
      };

      const mockSleep = vi.fn().mockImplementation((ms: number) => {
        sleepDurations.push(ms);
        return Promise.resolve();
      });

      await develop(tempDir, mockAI, {
        once: false,
        _sleepFn: mockSleep,
      });

      // Verify backoff progression: 1, 2, 4, 8, 16, 32, 64, 120, 120, 120 minutes
      expect(sleepDurations[0]).toBe(60 * 1000); // 1 min
      expect(sleepDurations[1]).toBe(2 * 60 * 1000); // 2 min
      expect(sleepDurations[2]).toBe(4 * 60 * 1000); // 4 min
      expect(sleepDurations[3]).toBe(8 * 60 * 1000); // 8 min
      expect(sleepDurations[4]).toBe(16 * 60 * 1000); // 16 min
      expect(sleepDurations[5]).toBe(32 * 60 * 1000); // 32 min
      expect(sleepDurations[6]).toBe(64 * 60 * 1000); // 64 min
      // After 64 min, doubling would give 128 min, but cap is 120 min
      expect(sleepDurations[7]).toBe(MAX_SLEEP_MS); // 120 min (capped)
      expect(sleepDurations[8]).toBe(MAX_SLEEP_MS); // 120 min (capped)
      expect(sleepDurations[9]).toBe(MAX_SLEEP_MS); // 120 min (capped)
    });
  });
});
