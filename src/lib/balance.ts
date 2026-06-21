// ─── Constantes de balanceo del motor de simulación ──────────────────────────
// Centralizar aquí TODAS las constantes numéricas para facilitar ajustes.
// Cada sección está documentada con la justificación de las fórmulas.

export const BALANCE = {
  // ─── Economía ────────────────────────────────────────────────────────────
  // Ingresos fiscales = poblaciónActiva * ingresoPerCapita * tasaImpositiva

  /** Tasa impositiva base sobre ingresos (15%) */
  TAX_RATE_BASE: 0.15,

  /** Ingreso mensual per cápita base en USD */
  BASE_MONTHLY_INCOME_PER_CAPITA: 500,

  /** Factor de aumento de inflación por déficit fiscal (por cada 1% de déficit) */
  INFLATION_DEFICIT_FACTOR: 0.02,

  /** Inflación base mensual sin déficit (0.2% mensual ≈ 2.4% anual) */
  BASE_INFLATION: 0.2,

  /** Umbral de inflación para crisis económica */
  INFLATION_CRISIS_THRESHOLD: 15,

  /** Cuánto cae el PIB cuando hay crisis económica */
  GDP_CRISIS_PENALTY: 5,

  // ─── Presupuestos ────────────────────────────────────────────────────────

  /** Presupuesto mínimo por ministerio (%) */
  MIN_BUDGET_PERCENT: 2,

  /** Presupuesto máximo por ministerio (%) */
  MAX_BUDGET_PERCENT: 40,

  /** Salario base mensual de un ministro en USD */
  BASE_SALARY_PER_MINISTER: 5000,

  // ─── Eficiencia ministerial ──────────────────────────────────────────────
  // eficiencia = budgetPercent * (1 - corrupcionInterna/100) * (skillMinistro/100) * 100

  /** Factor base de eficiencia ministerial */
  EFFICIENCY_BASE_FACTOR: 1.0,

  // ─── Corrupción ──────────────────────────────────────────────────────────

  /** Incremento base mensual de corrupción individual (sin controles) */
  CORRUPTION_BASE_INCREASE: 1.5,

  /** Factor de corrupción por presupuesto grande (>20% del total) */
  CORRUPTION_BUDGET_FACTOR: 0.1,

  /** Reducción mensual de corrupción por Contraloría activa (base) */
  COMPTROLLER_CORRUPTION_REDUCTION: 3,

  /** Reducción mensual de corrupción por Fiscalía Anticorrupción activa (base) */
  ANTICORRUPTION_CORRUPTION_REDUCTION: 2,

  /** Efecto disuasivo: reducción extra si hay casos judiciales en curso */
  CORRUPTION_DETERRENCE_BY_CASES: 0.5,

  /** Umbral de corrupción individual para abrir caso automático */
  CORRUPTION_AUTO_CASE_THRESHOLD: 60,

  // ─── Indicadores sociales ────────────────────────────────────────────────

  /** Pobreza: impacto de eficiencia de Desarrollo Social (por cada punto) */
  POVERTY_SOCIAL_DEV_FACTOR: -0.3,

  /** Pobreza: impacto del desempleo (por cada 1% de desempleo) */
  POVERTY_UNEMPLOYMENT_FACTOR: 0.5,

  /** Pobreza: impacto de inflación (por cada 1% de inflación) */
  POVERTY_INFLATION_FACTOR: 0.3,

  /** Desempleo: impacto de eficiencia de Economía (por cada punto) */
  UNEMPLOYMENT_ECONOMY_FACTOR: -0.4,

  /** Desempleo base (sin intervención) */
  UNEMPLOYMENT_BASE: 8,

  /** Salud/enfermos: impacto de eficiencia de Salud (por cada punto) */
  SICK_HEALTH_FACTOR: -0.5,

  /** Salud/enfermos base */
  SICK_BASE: 5,

  /** Seguridad alimentaria: impacto de eficiencia de Agricultura */
  FOOD_AGRICULTURE_FACTOR: 0.4,

  /** Seguridad alimentaria base */
  FOOD_BASE: 75,

  /** Crimen: impacto de eficiencia de Seguridad */
  CRIME_SECURITY_FACTOR: -0.6,

  /** Crimen: impacto de pobreza */
  CRIME_POVERTY_FACTOR: 0.3,

  /** Crimen: impacto de desempleo */
  CRIME_UNEMPLOYMENT_FACTOR: 0.4,

  /** Crimen base */
  CRIME_BASE: 10,

  /** Educación: impacto de eficiencia de Educación */
  EDUCATION_EDU_FACTOR: 0.5,

  /** Educación base */
  EDUCATION_BASE: 50,

  /** Gini: impacto de impuesto progresivo */
  GINI_PROGRESSIVE_TAX_FACTOR: -2,

  /** Gini: impacto de liberalización económica */
  GINI_LIBERALIZATION_FACTOR: 3,

  /** Gini base */
  GINI_BASE: 42,

  // ─── Aprobación ──────────────────────────────────────────────────────────

  /** Peso de indicadores en aprobación general */
  APPROVAL_INDICATOR_WEIGHT: 0.3,

  /** Peso de corrupción en aprobación (inverso) */
  APPROVAL_CORRUPTION_WEIGHT: 0.2,

  /** Peso de eventos recientes en aprobación */
  APPROVAL_EVENT_WEIGHT: 0.1,

  /** Aprobación base (sin modificadores) */
  APPROVAL_BASE: 50,

  // ─── Régimen ─────────────────────────────────────────────────────────────

  /** Umbrales para clasificación de régimen */
  REGIME_FULL_DEMOCRACY: 70,
  REGIME_DEFECTIVE_DEMOCRACY: 55,
  REGIME_HYBRID: 35,
  REGIME_AUTHORITARIAN: 20,

  /** Pesos especiales para democracia plena */
  REGIME_CRITICAL_METRICS: ["pressFreedom", "judicialIndependence", "politicalPluralism"] as const,

  /** Cuánto afecta censurar un medio */
  REGIME_CENSOR_PRESS_PENALTY: -15,
  REGIME_CENSOR_POWER_BONUS: 5,

  /** Efectos de acciones en métricas de régimen */
  REGIME_NOMBRAR_JUECES_AFINES: { judicial: -10, powerConcentration: 5 },
  REGIME_DISOLVER_CONGRESO: { pluralism: -30, powerConcentration: 25 },
  REGIME_ESTADO_EMERGENCIA_MENSUAL: { civilLiberties: -10 },
  REGIME_COMPRAR_VOTOS: { transparency: -15 },
  REGIME_LEY_TRANSPARENCIA: { transparency: 20 },
  REGIME_CONTRALORIA_AUTONOMA: { transparency: 15, judicial: 5 },
  REGIME_DEFENSORIA_AUTONOMA: { civilLiberties: 15 },
  REGIME_ELECCIONES_LIMPIAS: { pluralism: 10 },
  REGIME_SUBORDINAR_GENERALES: { militarySubordination: 10 },
  REGIME_MILITARES_COMO_MINISTROS: { militarySubordination: -10 },

  // ─── Eventos ─────────────────────────────────────────────────────────────

  /** Probabilidades base mensuales (se multiplican por severity ratio) */
  EVENT_EPIDEMIC_PROB: 0.08,
  EVENT_SCANDAL_PROB: 0.06,
  EVENT_PROTEST_PROB: 0.08,
  EVENT_CRIME_SURGE_PROB: 0.07,
  EVENT_COUP_PROB: 0.05,
  EVENT_DISASTER_PROB: 0.03,

  /** Umbrales para disparar eventos */
  EVENT_EPIDEMIC_HEALTH_THRESHOLD: 40,
  EVENT_SCANDAL_CORRUPTION_THRESHOLD: 40,
  EVENT_PROTEST_POVERTY_THRESHOLD: 50,
  EVENT_PROTEST_APPROVAL_THRESHOLD: 20,
  EVENT_CRIME_SURGE_THRESHOLD: 65,
  EVENT_COUP_APPROVAL_THRESHOLD: 25,
  EVENT_ECONOMIC_CRISIS_INFLATION: 15,

  // ─── Medios ──────────────────────────────────────────────────────────────

  /** Sentimiento base de cobertura (sin sesgo) */
  MEDIA_BASE_SENTIMENT: 0,

  /** Factor de sesgo por afinidad gubernamental */
  MEDIA_AFFINITY_SENTIMENT_FACTOR: 0.01,

  // ─── Justicia ────────────────────────────────────────────────────────────

  /** Meses por fase judicial */
  JUSTICE_INVESTIGATION_MIN_MONTHS: 3,
  JUSTICE_INVESTIGATION_MAX_MONTHS: 8,
  JUSTICE_TRIAL_MIN_MONTHS: 2,
  JUSTICE_TRIAL_MAX_MONTHS: 6,

  /** Probabilidad mensual de abrir caso automático cuando corrupción > threshold */
  JUSTICE_AUTO_CASE_MONTHLY_PROB: 0.04,

  // ─── Senado ──────────────────────────────────────────────────────────────

  /** Ciclo electoral en años */
  SENATE_ELECTION_CYCLE_YEARS: 4,

  /** Peso de la afinidad ideológica en el voto */
  SENATE_IDEOLOGY_WEIGHT: 0.6,

  /** Peso de la lealtad al partido en el voto */
  SENATE_PARTY_LOYALTY_WEIGHT: 0.25,

  /** Peso de la aprobación del gobierno en el voto */
  SENATE_APPROVAL_WEIGHT: 0.15,

  // ─── Población ───────────────────────────────────────────────────────────

  /** Crecimiento poblacional mensual base */
  POPULATION_GROWTH_RATE: 0.001, // 0.1% mensual ≈ 1.2% anual

  /** Tasa de mortalidad base mensual */
  POPULATION_DEATH_RATE: 0.0006,
} as const;

export type BalanceConfig = typeof BALANCE;
