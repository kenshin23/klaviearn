import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Auth from "./Auth.jsx";
import { setLocale } from "../lib/i18n.js";

vi.mock("../lib/api.js", () => ({
  api: { login: vi.fn(), register: vi.fn() },
  setToken: vi.fn(),
}));
const { api, setToken } = await import("../lib/api.js");

const show = () => {
  const onAuthed = vi.fn(), onGuest = vi.fn();
  render(<Auth onAuthed={onAuthed} onGuest={onGuest} />);
  return { onAuthed, onGuest };
};

const email = () => screen.getByLabelText(/Email/);
const password = () => screen.getByLabelText(/Password/);
const signupCode = () => screen.getByLabelText(/Signup code/);

beforeEach(() => setLocale("en", "letters"));

describe("logging in", () => {
  it("opens on the login form", () => {
    show();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("stores the token and reports success", async () => {
    api.login.mockResolvedValue({ token: "tok", email: "a@b.com" });
    const { onAuthed } = show();

    await userEvent.type(email(), "a@b.com");
    await userEvent.type(password(), "a good passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(api.login).toHaveBeenCalledWith("a@b.com", "a good passphrase");
    expect(setToken).toHaveBeenCalledWith("tok");
    expect(onAuthed).toHaveBeenCalled();
  });

  it("shows the server's message and stays put when login fails", async () => {
    api.login.mockRejectedValue(new Error("Wrong email or password"));
    const { onAuthed } = show();

    await userEvent.type(email(), "a@b.com");
    await userEvent.type(password(), "wrong passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password");
    expect(onAuthed).not.toHaveBeenCalled();
    expect(setToken).not.toHaveBeenCalled();
  });
});

describe("registering", () => {
  it("switches to the signup form and back", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Have an account/ }));
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("calls register rather than login in signup mode", async () => {
    api.register.mockResolvedValue({ token: "tok2", email: "new@b.com" });
    const { onAuthed } = show();

    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    await userEvent.type(email(), "new@b.com");
    await userEvent.type(password(), "a brand new passphrase");
    await userEvent.type(signupCode(), "abc123");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(api.register).toHaveBeenCalledWith("new@b.com", "a brand new passphrase", "abc123");
    expect(api.login).not.toHaveBeenCalled();
    expect(onAuthed).toHaveBeenCalled();
  });

  // The gate is the server's; this is only the box it is typed into. What
  // matters here is that it is asked for when signing up, never when logging
  // in, and that the server's refusal is shown rather than swallowed.
  it("asks for a signup code only when signing up", async () => {
    show();
    expect(screen.queryByLabelText(/Signup code/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    expect(signupCode()).toBeRequired();
    // Readable rather than masked: it is a shared code, not a secret of
    // theirs, and this app is built to be proofread with low vision.
    expect(signupCode()).toHaveAttribute("type", "text");
    expect(signupCode()).toHaveAttribute("autoComplete", "off");

    await userEvent.click(screen.getByRole("button", { name: /Have an account/ }));
    expect(screen.queryByLabelText(/Signup code/)).not.toBeInTheDocument();
  });

  it("shows the server's verdict when the code is wrong", async () => {
    api.register.mockRejectedValue(new Error("That signup code is not right"));
    const { onAuthed } = show();

    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    await userEvent.type(email(), "new@b.com");
    await userEvent.type(password(), "a brand new passphrase");
    await userEvent.type(signupCode(), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That signup code is not right");
    expect(onAuthed).not.toHaveBeenCalled();
    expect(setToken).not.toHaveBeenCalled();
  });

  it("clears a stale error when switching mode", async () => {
    api.login.mockRejectedValue(new Error("Wrong email or password"));
    show();
    await userEvent.type(email(), "a@b.com");
    await userEvent.type(password(), "wrong passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("the form itself", () => {
  it("asks the browser for the right autofill and validation", async () => {
    show();
    expect(email()).toHaveAttribute("type", "email");
    expect(email()).toBeRequired();
    expect(password()).toHaveAttribute("type", "password");
    expect(password()).toHaveAttribute("minLength", "8");
    expect(password()).toHaveAttribute("autoComplete", "current-password");

    await userEvent.click(screen.getByRole("button", { name: /New here/ }));
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("autoComplete", "new-password");
  });

  it("offers practice without an account", async () => {
    const { onGuest } = show();
    await userEvent.click(screen.getByRole("button", { name: /Practice without an account/ }));
    expect(onGuest).toHaveBeenCalled();
  });

  it("translates into Spanish", () => {
    setLocale("es", "solfege");
    show();
    expect(screen.getByRole("heading", { name: "Bienvenido de nuevo" })).toBeInTheDocument();
  });
});
