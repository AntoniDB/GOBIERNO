const FF = "var(--font-barlow-condensed,'Barlow Condensed',sans-serif)";
const FFM = "var(--font-share-tech-mono,'Share Tech Mono',monospace)";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0A0A0A",
        fontFamily: FF,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480, padding: "0 24px" }}>
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
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
                fontSize: 24,
                color: "#00C2B8",
              }}
            >
              A
            </span>
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: FF,
            fontWeight: 900,
            fontSize: 42,
            color: "#FFFFFF",
            letterSpacing: 8,
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          ARKON
        </div>
        <div style={{ fontFamily: FFM, fontSize: 11, color: "#00C2B8", letterSpacing: 3, marginBottom: 32 }}>
          GOV.OS v2.094 — SIMULADOR DE GOBIERNO
        </div>

        {/* Separator */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.08)", marginBottom: 32 }} />

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
            letterSpacing: 1,
            lineHeight: 1.7,
            marginBottom: 36,
          }}
        >
          Toma el control de un país. Gestiona ministerios, promulga leyes,
          combate la corrupción y enfrenta las consecuencias de tus decisiones.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a
            href="/registro"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 32px",
              background: "#00C2B8",
              border: "2.5px solid #FFFFFF",
              boxShadow: "4px 4px 0 #FFFFFF",
              fontFamily: FF,
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 3,
              color: "#0A0A0A",
              textDecoration: "none",
            }}
          >
            ▶ CREAR CUENTA
          </a>
          <a
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "14px 32px",
              background: "transparent",
              border: "2.5px solid rgba(255,255,255,0.3)",
              fontFamily: FF,
              fontWeight: 700,
              fontSize: 14,
              letterSpacing: 3,
              color: "rgba(255,255,255,0.7)",
              textDecoration: "none",
            }}
          >
            INGRESAR
          </a>
        </div>

        {/* Status line */}
        <div
          style={{
            marginTop: 48,
            fontSize: 9,
            color: "rgba(255,255,255,0.2)",
            letterSpacing: 2,
            fontWeight: 700,
            lineHeight: 2.2,
          }}
        >
          <div>● SYS: ONLINE</div>
          <div>● CIFRADO: AES-2048</div>
          <div>● SESIÓN: SEGURA</div>
        </div>
      </div>
    </main>
  );
}
