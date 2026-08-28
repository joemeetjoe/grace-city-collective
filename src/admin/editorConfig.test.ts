import { describe, expect, it } from "vitest";

import { missingEditorVars, readEditorConfig } from "./editorConfig";

const full = {
  VITE_EDITOR_API_URL: "https://abc.execute-api.us-east-1.amazonaws.com",
  VITE_EDITOR_REGION: "us-east-1",
  VITE_EDITOR_USER_POOL_ID: "us-east-1_AbCdEf",
  VITE_EDITOR_CLIENT_ID: "1234567890abcdef",
};

describe("readEditorConfig", () => {
  it("returns the four values, trimming a trailing slash off the API URL", () => {
    expect(readEditorConfig({ ...full, VITE_EDITOR_API_URL: `${full.VITE_EDITOR_API_URL}/` })).toEqual({
      apiUrl: full.VITE_EDITOR_API_URL,
      region: "us-east-1",
      userPoolId: "us-east-1_AbCdEf",
      clientId: "1234567890abcdef",
    });
  });

  it("returns null, naming what is missing, when any value is absent", () => {
    const result = readEditorConfig({ ...full, VITE_EDITOR_CLIENT_ID: "", VITE_EDITOR_REGION: undefined });
    expect(result).toBeNull();
  });

  it("lists the missing variables", () => {
    expect(missingEditorVars({ ...full, VITE_EDITOR_CLIENT_ID: "" })).toEqual(["VITE_EDITOR_CLIENT_ID"]);
  });
});
