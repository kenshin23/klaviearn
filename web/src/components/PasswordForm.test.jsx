import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PasswordForm from "./PasswordForm.jsx";
import { setLocale } from "../lib/i18n.js";

vi.mock("../lib/api.js", () => ({ api: { changePassword: vi.fn() }, setToken: vi.fn() }));
const { api, setToken } = await import("../lib/api.js");

const current = () => screen.getByLabelText(/Current password/);
const next = () => screen.getByLabelText(/New password/);
const submit = () => screen.getByRole("button", { name: "Change password" });

async function fillAndSubmit(a = "old passphrase", b = "new passphrase") {
  await userEvent.type(current(), a);
  await userEvent.type(next(), b);
  await userEvent.click(submit());
}

beforeEach(() => setLocale("en", "letters"));

describe("changing the password", () => {
  it("sends the current and new passwords", async () => {
    api.changePassword.mockResolvedValue({ ok: true });
    render(<PasswordForm />);
    await fillAndSubmit();
    expect(api.changePassword).toHaveBeenCalledWith("old passphrase", "new passphrase");
  });

  it("stores the refreshed token, so the change does not sign you out here", async () => {
    // The server revokes every token on a password change; the reply carries
    // a live one for the tab that made the change.
    api.changePassword.mockResolvedValue({ ok: true, token: "fresh-token" });
    render(<PasswordForm />);
    await fillAndSubmit();
    expect(setToken).toHaveBeenCalledWith("fresh-token");
  });

  it("copes with a server that sends no replacement token", async () => {
    api.changePassword.mockResolvedValue({ ok: true });
    render(<PasswordForm />);
    await fillAndSubmit();
    expect(setToken).not.toHaveBeenCalled();
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });

  it("confirms success and empties the fields", async () => {
    api.changePassword.mockResolvedValue({ ok: true });
    render(<PasswordForm />);
    await fillAndSubmit();

    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
    expect(current()).toHaveValue("");
    expect(next()).toHaveValue("");
  });

  it("shows the server's rejection and keeps what you typed", async () => {
    api.changePassword.mockRejectedValue(new Error("Current password is wrong"));
    render(<PasswordForm />);
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is wrong");
    expect(current()).toHaveValue("old passphrase");
  });

  it("translates its labels and the server's rejection", async () => {
    setLocale("es", "solfege");
    api.changePassword.mockRejectedValue(new Error("Current password is wrong"));
    render(<PasswordForm />);

    expect(screen.getByRole("heading", { name: "Cambiar contraseña" })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Contraseña actual/), "old passphrase");
    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), "new passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(await screen.findByRole("alert"))
      .toHaveTextContent("La contraseña actual es incorrecta");
  });
});

describe("the form itself", () => {
  it("asks the browser for the right autofill and a minimum length", () => {
    render(<PasswordForm />);
    expect(current()).toHaveAttribute("type", "password");
    expect(current()).toHaveAttribute("autoComplete", "current-password");
    expect(next()).toHaveAttribute("autoComplete", "new-password");
    expect(next()).toHaveAttribute("minLength", "8");
    expect(next()).toBeRequired();
  });

  it("does not call the API when the fields are empty", async () => {
    render(<PasswordForm />);
    await userEvent.click(submit());
    expect(api.changePassword).not.toHaveBeenCalled();
  });
});
