import { describe, expect, it, vi } from "vitest";

import { completeNewPassword, signIn } from "./cognito";

const cfg = { region: "us-east-1", clientId: "client-1" };

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/x-amz-json-1.1" } }));
}

describe("signIn", () => {
  it("posts USER_PASSWORD_AUTH to the regional endpoint and returns the id token", async () => {
    const fetchImpl = respond(200, { AuthenticationResult: { IdToken: "id.token", AccessToken: "a", RefreshToken: "r" } });
    const result = await signIn(cfg, "me@example.com", "pw", fetchImpl);
    expect(result).toEqual({ kind: "ok", idToken: "id.token" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://cognito-idp.us-east-1.amazonaws.com/");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Amz-Target"]).toBe("AWSCognitoIdentityProviderService.InitiateAuth");
    expect(headers["Content-Type"]).toBe("application/x-amz-json-1.1");
    expect(JSON.parse(init.body as string)).toEqual({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "client-1",
      AuthParameters: { USERNAME: "me@example.com", PASSWORD: "pw" },
    });
  });

  it("surfaces the NEW_PASSWORD_REQUIRED challenge with its session", async () => {
    const fetchImpl = respond(200, {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: "sess-1",
      ChallengeParameters: { USER_ID_FOR_SRP: "me@example.com" },
    });
    await expect(signIn(cfg, "me@example.com", "temp", fetchImpl)).resolves.toEqual({
      kind: "new-password",
      session: "sess-1",
      username: "me@example.com",
    });
  });

  it("turns a Cognito error into a readable message", async () => {
    const fetchImpl = respond(400, { __type: "NotAuthorizedException", message: "Incorrect username or password." });
    await expect(signIn(cfg, "me@example.com", "wrong", fetchImpl)).resolves.toEqual({
      kind: "error",
      message: "Incorrect username or password.",
    });
  });

  it("reports a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await signIn(cfg, "me@example.com", "pw", fetchImpl);
    expect(result.kind).toBe("error");
  });
});

describe("completeNewPassword", () => {
  it("answers the challenge and returns the id token", async () => {
    const fetchImpl = respond(200, { AuthenticationResult: { IdToken: "fresh.token" } });
    const result = await completeNewPassword(cfg, { session: "sess-1", username: "me@example.com" }, "N3w-Password!", fetchImpl);
    expect(result).toEqual({ kind: "ok", idToken: "fresh.token" });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["X-Amz-Target"]).toBe("AWSCognitoIdentityProviderService.RespondToAuthChallenge");
    expect(JSON.parse(init.body as string)).toEqual({
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: "client-1",
      Session: "sess-1",
      ChallengeResponses: { USERNAME: "me@example.com", NEW_PASSWORD: "N3w-Password!" },
    });
  });
});
