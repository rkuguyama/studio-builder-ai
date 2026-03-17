import { describe, expect, it } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("builds stable app and chat keys", () => {
    expect(queryKeys.apps.detail(10)).toEqual(["app", 10]);
    expect(queryKeys.chat.detail(4)).toEqual(["chat", 4]);
    expect(queryKeys.chat.list()).toEqual(["chats", "all"]);
    expect(queryKeys.chat.list(11)).toEqual(["chats", 11]);
  });

  it("builds plan and preview keys", () => {
    expect(queryKeys.plan.byChat(1, 99)).toEqual(["plan-by-chat", 1, 99]);
    expect(queryKeys.apps.previewUrl(77)).toEqual(["preview-url", 77]);
  });
});
