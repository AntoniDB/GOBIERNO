// Secreto con el que se firman las sesiones (JWT). Auth.js v5 lo lee de AUTH_SECRET; el nombre
// anterior era NEXTAUTH_SECRET. El middleware leía solo NEXTAUTH_SECRET y `auth.ts` solo AUTH_SECRET,
// así que con una sola definida el middleware lanzaba "MissingSecret". Ahora los dos usan esta función
// y basta con definir cualquiera de las dos variables.

type Env = Record<string, string | undefined>;

/** AUTH_SECRET o, si falta, NEXTAUTH_SECRET; undefined si no hay ninguna (valores vacíos cuentan como ausentes). */
export function readAuthSecret(env: Env = process.env): string | undefined {
  for (const name of ["AUTH_SECRET", "NEXTAUTH_SECRET"]) {
    const value = env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Igual que readAuthSecret pero con un error claro (sin valores) cuando no hay secreto. */
export function requireAuthSecret(env: Env = process.env): string {
  const secret = readAuthSecret(env);
  if (!secret) {
    throw new Error(
      "Falta AUTH_SECRET (o NEXTAUTH_SECRET). Defínelo en .env con una cadena larga y aleatoria, p. ej. `openssl rand -base64 32`, y reinicia `npm run dev`.",
    );
  }
  return secret;
}
