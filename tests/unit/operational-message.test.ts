import { describe, expect, it } from "vitest";
import { sanitizeOperationalMessage } from "@/security/sanitize-operational-message";

describe("operational message redaction", () => {
  it("removes URLs, authorization values, credential-like fields and control characters", () => {
    const sanitized = sanitizeOperationalMessage("failed https://provider.example/path?api_key=leak Bearer abc.def secret=hunter2\nretry");
    expect(sanitized).toBe("failed [redacted-url] [redacted-authorization] secret=[redacted] retry");
    expect(sanitized).not.toMatch(/provider|leak|abc\.def|hunter2/);
  });
});
