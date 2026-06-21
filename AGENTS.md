# Simulador de Gobierno y Sociedad

   Proyecto Next.js 14+ con TypeScript, Prisma, PostgreSQL, Tailwind y shadcn/ui.

   La especificación completa está en `SPEC.md`. Léelo siempre antes de empezar cualquier trabajo.

   ## Reglas de oro
   - Respetar siempre la especificación de SPEC.md, no simplificar ni saltarse partes definidas
   - El motor de cálculo de turno corre en servidor (Server Actions), nunca en cliente
   - El motor debe ser puro y determinista (sembrado)
   - Centralizar constantes de balanceo en `lib/balance.ts`
   - Crear tests para cualquier función pura del motor
   - Comentar las fórmulas con su justificación
   - i18n: todo el código y UI en español