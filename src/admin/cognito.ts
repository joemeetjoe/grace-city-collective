/**
 * Sign-in against the Cognito user pool with plain fetch: the JSON 1.1
 * protocol needs no SDK. `USER_PASSWORD_AUTH` returns either tokens or, on
 * a first sign-in with the emailed temporary password, a
 * NEW_PASSWORD_REQUIRED challenge that `completeNewPassword` answers. Only
 * the id token comes back; it lives in component state, never in storage.
 */

export type CognitoConfig = { region: string; clientId: string };

export type NewPasswordChallenge = { session: string; username: string };

export type AuthResult =
  | { kind: "ok"; idToken: string }
  | { kind: "new-password"; session: string; username: string }
  | { kind: "error"; message: string };

type CognitoResponse = {
  AuthenticationResult?: { IdToken?: string };
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
  __type?: string;
  message?: string;
};

async function call(cfg: CognitoConfig, target: string, payload: unknown, fetchImpl: typeof fetch): Promise<AuthResult> {
  let response: Response;
  try {
    response = await fetchImpl(`https://cognito-idp.${cfg.region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return { kind: "error", message: `could not reach Cognito: ${String(error)}` };
  }

  let data: CognitoResponse;
  try {
    data = (await response.json()) as CognitoResponse;
  } catch {
    return { kind: "error", message: `Cognito answered ${response.status}` };
  }

  if (!response.ok) {
    return { kind: "error", message: data.message ?? data.__type ?? `Cognito answered ${response.status}` };
  }
  if (data.ChallengeName === "NEW_PASSWORD_REQUIRED" && data.Session) {
    return {
      kind: "new-password",
      session: data.Session,
      username: data.ChallengeParameters?.USER_ID_FOR_SRP ?? data.ChallengeParameters?.USERNAME ?? "",
    };
  }
  if (data.ChallengeName) {
    return { kind: "error", message: `unsupported sign-in challenge: ${data.ChallengeName}` };
  }
  const idToken = data.AuthenticationResult?.IdToken;
  if (!idToken) return { kind: "error", message: "Cognito returned no id token" };
  return { kind: "ok", idToken };
}

export function signIn(cfg: CognitoConfig, email: string, password: string, fetchImpl: typeof fetch = fetch): Promise<AuthResult> {
  return call(
    cfg,
    "InitiateAuth",
    { AuthFlow: "USER_PASSWORD_AUTH", ClientId: cfg.clientId, AuthParameters: { USERNAME: email, PASSWORD: password } },
    fetchImpl,
  );
}

export function completeNewPassword(
  cfg: CognitoConfig,
  challenge: NewPasswordChallenge,
  newPassword: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AuthResult> {
  return call(
    cfg,
    "RespondToAuthChallenge",
    {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: cfg.clientId,
      Session: challenge.session,
      ChallengeResponses: { USERNAME: challenge.username, NEW_PASSWORD: newPassword },
    },
    fetchImpl,
  );
}
