"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { registerAction } from "@/app/actions/register";

const FF  = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const result = await registerAction(email, password);

    if (!result.success) {
      setError(result.error ?? "Error al registrar.");
      setLoading(false);
      return;
    }

    const signInResult = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (signInResult?.error) {
      setError("Cuenta creada pero no se pudo iniciar sesión. Intenta desde /login.");
    } else {
      router.push("/dashboard");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "#F5F0E8",
    border: "2px solid #0A0A0A",
    fontFamily: FF,
    fontSize: 13,
    fontWeight: 600,
    color: "#0A0A0A",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0A",
        fontFamily: FF,
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                border: "3px solid #00C2B8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "rotate(45deg)",
              }}
            >
              <span
                style={{
                  transform: "rotate(-45deg)",
                  fontFamily: FF,
                  fontWeight: 900,
                  fontSize: 18,
                  color: "#00C2B8",
                }}
              >
                A
              </span>
            </div>
          </div>
          <div style={{ fontFamily: FF, fontWeight: 900, fontSize: 28, color: "#FFFFFF", letterSpacing: 5, marginBottom: 4 }}>
            ARKON
          </div>
          <div style={{ fontFamily: FFM, fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: 2 }}>
            GOV.OS — NUEVO ACCESO AL SISTEMA
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#FFFFFF",
            border: "2.5px solid #FFFFFF",
            boxShadow: "6px 6px 0 #00C2B8",
            padding: 28,
          }}
        >
          <div
            style={{
              background: "#0A0A0A",
              color: "#FFFFFF",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2.5,
              padding: "4px 12px",
              display: "inline-block",
              marginBottom: 20,
            }}
          >
            CREAR CUENTA
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#666", marginBottom: 6 }}>
                CORREO ELECTRÓNICO
              </label>
              <input
                type="email"
                placeholder="usuario@sistema.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#666", marginBottom: 6 }}>
                CONTRASEÑA
              </label>
              <input
                type="password"
                placeholder="Mínimo 4 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#666", marginBottom: 6 }}>
                CONFIRMAR CONTRASEÑA
              </label>
              <input
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  border: "2px solid #FF2090",
                  borderLeft: "6px solid #FF2090",
                  background: "rgba(255,32,144,0.06)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FF2090",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "14px 24px",
                background: loading ? "#008E8A" : "#00C2B8",
                border: "2.5px solid #0A0A0A",
                boxShadow: "3px 3px 0 #0A0A0A",
                fontFamily: FF,
                fontSize: 14,
                fontWeight: 900,
                color: "#0A0A0A",
                letterSpacing: 3,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "▶ CREANDO CUENTA..." : "▶ CREAR CUENTA"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: "#888", marginTop: 20 }}>
            Ya tienes cuenta?{" "}
            <a href="/login" style={{ color: "#00C2B8", fontWeight: 800, textDecoration: "none" }}>
              INGRESAR
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
