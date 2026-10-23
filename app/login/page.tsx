"use client";
import { useState } from "react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="brand">
        <span className="brand-icon">g</span> growth
        <span className="muted">/ ai</span>
      </div>
      <div className="login-card">
        <span className="eyebrow">CENTRO DE OPERAÇÕES</span>
        <h1>
          Sua próxima
          <br />
          curva de crescimento.
        </h1>
        <p className="muted">
          Entre para acompanhar os agentes e suas decisões.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const r = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: form.get("email") || undefined,
                  password: form.get("password"),
                }),
              });
              if (r.ok) window.location.href = "/";
              else setError((await r.json()).error);
            } catch {
              setError("Não foi possível conectar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            E-mail <span className="muted">(conta Supabase em modo live)</span>
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="voce@empresa.com"
            />
          </label>
          <label>
            Senha
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Entrando…" : "Entrar no workspace →"}
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
        <p className="fine">
          Simulação usa senha administrativa local. Nenhuma ação externa é
          habilitada.
        </p>
      </div>
    </main>
  );
}
