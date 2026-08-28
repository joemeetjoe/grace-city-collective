import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteEditor } from "./SiteEditor";
import type { EditorConfig } from "./editorConfig";
import { site } from "@/content/site";

const config: EditorConfig = {
  apiUrl: "https://api.example.com",
  region: "us-east-1",
  userPoolId: "us-east-1_pool",
  clientId: "client",
};

function auth(overrides: Partial<Parameters<typeof SiteEditor>[0]["auth"] & object> = {}) {
  return {
    signIn: vi.fn(async () => ({ kind: "ok" as const, idToken: "id.token" })),
    completeNewPassword: vi.fn(async () => ({ kind: "ok" as const, idToken: "id.token" })),
    ...overrides,
  };
}

async function signIn() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2hunter2!" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByRole("button", { name: "Publish" });
}

describe("SiteEditor", () => {
  it("says the editor is not configured, naming the missing variables", () => {
    render(<SiteEditor config={null} missing={["VITE_EDITOR_API_URL"]} initialContent={site} />);
    expect(screen.getByText(/editor not configured/i)).toBeTruthy();
    expect(screen.getByText(/VITE_EDITOR_API_URL/)).toBeTruthy();
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("signs in through the provided auth and then shows the form", async () => {
    const a = auth();
    render(<SiteEditor config={config} initialContent={site} auth={a} publish={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Publish" })).toBeNull();
    await signIn();
    expect(a.signIn).toHaveBeenCalledWith("me@example.com", "hunter2hunter2!");
  });

  it("asks for a new password when Cognito demands one, then signs in", async () => {
    const a = auth({
      signIn: vi.fn(async () => ({ kind: "new-password" as const, session: "s", username: "me@example.com" })),
    });
    render(<SiteEditor config={config} initialContent={site} auth={a} publish={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Temp-pass-123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const fresh = await screen.findByLabelText("New password");
    fireEvent.change(fresh, { target: { value: "Long-enough-Pass-1!" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await screen.findByRole("button", { name: "Publish" });
    expect(a.completeNewPassword).toHaveBeenCalledWith({ session: "s", username: "me@example.com" }, "Long-enough-Pass-1!");
  });

  it("shows a sign-in error", async () => {
    const a = auth({ signIn: vi.fn(async () => ({ kind: "error" as const, message: "Incorrect username or password." })) });
    render(<SiteEditor config={config} initialContent={site} auth={a} publish={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Incorrect username or password.")).toBeTruthy();
  });

  it("editing a scene heading updates the preview", async () => {
    render(<SiteEditor config={config} initialContent={site} auth={auth()} publish={vi.fn()} />);
    await signIn();

    const field = screen.getByLabelText("scene[2].heading") as HTMLInputElement;
    expect(field.value).toBe("Small rooms, long tables, real names.");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "Rooms, tables, names." } });

    const preview = screen.getByTestId("preview");
    expect(preview.textContent).toContain("Rooms, tables, names.");
    expect(preview.textContent).not.toContain("Small rooms, long tables, real names.");
  });

  it("adds and removes array items", async () => {
    render(<SiteEditor config={config} initialContent={site} auth={auth()} publish={vi.fn()} />);
    await signIn();

    fireEvent.click(screen.getByRole("button", { name: "Add faq item" }));
    const added = screen.getByLabelText(`faq[${site.faq.length}].question`) as HTMLInputElement;
    expect(added.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Remove faq[0]" }));
    expect((screen.getByLabelText("faq[0].question") as HTMLInputElement).value).toBe(site.faq[1].question);
  });

  it("publishes the edited content with the id token and confirms", async () => {
    const publish = vi.fn(async () => ({ ok: true as const }));
    render(<SiteEditor config={config} initialContent={site} auth={auth()} publish={publish} />);
    await signIn();

    fireEvent.change(screen.getByRole("textbox", { name: "name" }), { target: { value: "Grace City, edited" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(publish).toHaveBeenCalledOnce());
    const [content, token] = publish.mock.calls[0] as unknown as [typeof site, string];
    expect(content.name).toBe("Grace City, edited");
    expect(token).toBe("id.token");
    expect(await screen.findByText(/published/i)).toBeTruthy();
  });

  it("shows the server's readable errors when publishing fails", async () => {
    const publish = vi.fn(async () => ({ ok: false as const, errors: ["scene[2].heading: expected string"] }));
    render(<SiteEditor config={config} initialContent={site} auth={auth()} publish={publish} />);
    await signIn();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("scene[2].heading: expected string")).toBeTruthy();
  });

  it("refuses to publish an invalid document locally, with the same paths", async () => {
    const publish = vi.fn();
    render(<SiteEditor config={config} initialContent={site} auth={auth()} publish={publish} />);
    await signIn();
    fireEvent.change(screen.getByLabelText("contact.email"), { target: { value: "" } });
    // an empty string is still a string; blank a required select instead
    fireEvent.change(screen.getByLabelText("nav[0].id"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText(/nav\[0\]\.id: expected one of/)).toBeTruthy();
    expect(publish).not.toHaveBeenCalled();
  });
});
