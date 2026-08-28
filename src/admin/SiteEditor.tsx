/**
 * The admin page: sign in with Cognito, edit every field of the content,
 * see it in proportion, publish. State is three things — the id token (in
 * memory only), the document being edited, and the last publish result.
 */

import { useState, type FormEvent } from "react";

import { completeNewPassword as cognitoNewPassword, signIn as cognitoSignIn, type AuthResult, type NewPasswordChallenge } from "./cognito";
import type { EditorConfig } from "./editorConfig";
import { Field } from "./Fields";
import { Preview } from "./Preview";
import { publishContent, type PublishResult } from "./publish";
import { validateSite } from "@/content/schema";
import type { SiteContent } from "@/content/site";

type Auth = {
  signIn: (email: string, password: string) => Promise<AuthResult>;
  completeNewPassword: (challenge: NewPasswordChallenge, newPassword: string) => Promise<AuthResult>;
};

type Props = {
  config: EditorConfig | null;
  /** VITE_EDITOR_* names that are unset, shown when config is null */
  missing?: string[];
  initialContent: SiteContent;
  auth?: Auth;
  publish?: (content: SiteContent, idToken: string) => Promise<PublishResult>;
};

const serif = "[font-family:'Cormorant_Garamond',Georgia,serif]";
const inputCls =
  "w-full rounded-md border border-cream/20 bg-cream/5 px-3 py-2 text-[15px] text-cream outline-none transition-colors focus:border-seal";
const primaryBtn =
  "rounded-full bg-seal px-7 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-cream transition-colors hover:bg-seal-deep disabled:opacity-50";
const quietBtn = "text-[11px] uppercase tracking-[0.18em] text-cream/60 transition-colors hover:text-cream";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink px-[clamp(20px,4.4vw,60px)] py-10 font-sans text-cream">
      <header className="mb-10 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className={`text-[32px] leading-none ${serif}`}>Grace City Collective · edit</h1>
        <a href="/" className={quietBtn}>
          View site →
        </a>
      </header>
      {children}
    </div>
  );
}

function NotConfigured({ missing }: { missing: string[] }) {
  return (
    <Shell>
      <div className="max-w-[60ch] flex flex-col gap-4">
        <h2 className={`text-[26px] ${serif}`}>Editor not configured</h2>
        <p className="text-cream/75">
          This build has no editor connection. Deploy <code>infra/editor.yml</code> and set these build variables (see
          <code> infra/README.md</code>):
        </p>
        <ul className="list-disc pl-5 text-cream/75">
          {missing.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

function SignIn({ auth, onToken }: { auth: Auth; onToken: (t: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fresh, setFresh] = useState("");
  const [challenge, setChallenge] = useState<NewPasswordChallenge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const settle = (result: AuthResult) => {
    setBusy(false);
    if (result.kind === "ok") onToken(result.idToken);
    else if (result.kind === "new-password") setChallenge({ session: result.session, username: result.username || email });
    else setError(result.message);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    settle(challenge ? await auth.completeNewPassword(challenge, fresh) : await auth.signIn(email, password));
  };

  return (
    <Shell>
      <form onSubmit={submit} className="flex max-w-[380px] flex-col gap-5">
        <h2 className={`text-[26px] ${serif}`}>{challenge ? "Choose a new password" : "Sign in"}</h2>
        {challenge ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-cream/50">New password</span>
            <input aria-label="New password" type="password" autoComplete="new-password" value={fresh} onChange={(e) => setFresh(e.target.value)} className={inputCls} />
          </label>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-cream/50">Email</span>
              <input aria-label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.18em] text-cream/50">Password</span>
              <input aria-label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </label>
          </>
        )}
        {error && <p className="text-sm text-seal-highlight">{error}</p>}
        <button type="submit" disabled={busy} className={`${primaryBtn} self-start`}>
          {challenge ? "Set password" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}

function Editor({
  initialContent,
  idToken,
  publish,
  onSignOut,
}: {
  initialContent: SiteContent;
  idToken: string;
  publish: (content: SiteContent, idToken: string) => Promise<PublishResult>;
  onSignOut: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [active, setActive] = useState<keyof SiteContent>("scene");
  const [status, setStatus] = useState<{ kind: "idle" } | { kind: "busy" } | { kind: "done" } | { kind: "errors"; errors: string[] }>({ kind: "idle" });
  const dirty = content !== initialContent;

  const doPublish = async () => {
    const check = validateSite(content);
    if (!check.ok) {
      setStatus({ kind: "errors", errors: check.errors });
      return;
    }
    setStatus({ kind: "busy" });
    const result = await publish(content, idToken);
    if (result.ok) setStatus({ kind: "done" });
    else {
      setStatus({ kind: "errors", errors: result.errors });
      if (result.errors[0]?.includes("sign in again")) onSignOut();
    }
  };

  const keys = Object.keys(content) as (keyof SiteContent)[];

  return (
    <Shell>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-12">
          <div className="sticky top-0 z-10 -mx-2 flex flex-wrap items-center gap-4 rounded-lg bg-ink/90 px-2 py-3 backdrop-blur-sm">
            <button type="button" onClick={doPublish} disabled={status.kind === "busy"} className={primaryBtn}>
              Publish
            </button>
            <span className="text-xs text-cream/50">
              {status.kind === "busy" && "Publishing…"}
              {status.kind === "done" && "Published — live within a minute."}
              {status.kind === "idle" && (dirty ? "Unpublished changes." : "Nothing changed yet.")}
              {status.kind === "errors" && `${status.errors.length} problem${status.errors.length === 1 ? "" : "s"}.`}
            </span>
            <button type="button" onClick={onSignOut} className={`${quietBtn} ml-auto`}>
              Sign out
            </button>
            {status.kind === "errors" && (
              <ul className="w-full list-disc pl-5 text-sm text-seal-highlight">
                {status.errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          {keys.map((key) => (
            <section key={key} id={`section-${key}`} onFocusCapture={() => setActive(key)} className="flex flex-col gap-5">
              <h2 className={`text-[26px] leading-none ${serif}`}>{key}</h2>
              <Field content={content} path={[key]} onChange={setContent} />
            </section>
          ))}
        </form>

        {/* beside the form on wide screens, below it on narrow ones */}
        <aside>
          <div className="rounded-xl border border-cream/15 p-8 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
            <Preview section={active} value={content[active]} />
          </div>
        </aside>
      </div>
    </Shell>
  );
}

export function SiteEditor({ config, missing = [], initialContent, auth, publish }: Props) {
  const [idToken, setIdToken] = useState<string | null>(null);
  if (!config) return <NotConfigured missing={missing} />;

  const cognito = { region: config.region, clientId: config.clientId };
  const realAuth: Auth = auth ?? {
    signIn: (email, password) => cognitoSignIn(cognito, email, password),
    completeNewPassword: (challenge, fresh) => cognitoNewPassword(cognito, challenge, fresh),
  };
  const realPublish = publish ?? ((content, token) => publishContent(config.apiUrl, token, content));

  if (!idToken) return <SignIn auth={realAuth} onToken={setIdToken} />;
  return <Editor initialContent={initialContent} idToken={idToken} publish={realPublish} onSignOut={() => setIdToken(null)} />;
}
