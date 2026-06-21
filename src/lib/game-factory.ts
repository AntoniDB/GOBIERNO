// ─── Fabrica de juegos: funciones puras para generar entidades iniciales ──
// Segun preset y dificultad. Usado por el wizard de nueva partida.
// Nombres en espaniol, ideologias realistas, sin dependencia de DB.

export interface PresetConfig {
  treasury: number;
  population: number;
  regimeMetrics: {
    powerConcentration: number;
    pressFreedom: number;
    judicialIndependence: number;
    politicalPluralism: number;
    civilLiberties: number;
    transparency: number;
    militarySubordination: number;
  };
  socialClasses: {
    extremePovertyPct: number;
    povertyPct: number;
    middlePct: number;
    elitePct: number;
  };
  initialCorruption: number;
  baseApproval: number;
  gdpBase: number;
  povertyRate: number;
  unemploymentRate: number;
  inflation: number;
  gini: number;
  eventFrequencyMult: number;
}

export type PresetKey = "estable_democratico" | "pobre_con_potencial" | "crisis_economica" | "post_conflicto";
export type Difficulty = "facil" | "normal" | "dificil";

const NOMBRES = [
  "Alejandro", "Beatriz", "Carlos", "Dolores", "Enrique", "Francisca", "Gabriel",
  "Helena", "Ignacio", "Jimena", "Lorenzo", "Marina", "Nicolas", "Ofelia", "Pedro",
  "Renata", "Santiago", "Teresa", "Ulises", "Valentina", "Xavier", "Yolanda",
  "Andres", "Camila", "Diego", "Elena", "Felipe", "Gloria", "Hugo", "Isabel",
];

const APELLIDOS = [
  "Garcia", "Martinez", "Lopez", "Hernandez", "Gonzalez", "Rodriguez", "Perez",
  "Sanchez", "Ramirez", "Cruz", "Flores", "Morales", "Ortiz", "Reyes", "Vargas",
  "Castro", "Mendoza", "Romero", "Torres", "Herrera", "Medina", "Aguilar",
  "Silva", "Rojas", "Moreno", "Vega", "Delgado", "Campos", "Paredes", "Fuentes",
];

export function nombreAleatorio(i: number): string {
  return `${NOMBRES[i % NOMBRES.length]} ${APELLIDOS[(i * 3) % APELLIDOS.length]} ${APELLIDOS[(i * 7 + 5) % APELLIDOS.length]}`;
}

export function generateSeed(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let seed = "";
  for (let i = 0; i < 12; i++) {
    seed += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${seed}-${Date.now()}`;
}

export function getPresetConfig(preset: PresetKey, difficulty: Difficulty): PresetConfig {
  const diffMult = difficulty === "facil" ? 0.6 : difficulty === "dificil" ? 1.5 : 1;

  const presets: Record<PresetKey, PresetConfig> = {
    estable_democratico: {
      treasury: 8_000_000_000,
      population: 50_000_000,
      regimeMetrics: {
        powerConcentration: 20,
        pressFreedom: 80,
        judicialIndependence: 75,
        politicalPluralism: 80,
        civilLiberties: 78,
        transparency: 65,
        militarySubordination: 75,
      },
      socialClasses: { extremePovertyPct: 5, povertyPct: 18, middlePct: 65, elitePct: 12 },
      initialCorruption: 6,
      baseApproval: 62,
      gdpBase: 400_000_000_000,
      povertyRate: 8,
      unemploymentRate: 5,
      inflation: 2.5,
      gini: 35,
      eventFrequencyMult: 0.7,
    },
    pobre_con_potencial: {
      treasury: 2_000_000_000,
      population: 80_000_000,
      regimeMetrics: {
        powerConcentration: 45,
        pressFreedom: 50,
        judicialIndependence: 45,
        politicalPluralism: 55,
        civilLiberties: 50,
        transparency: 35,
        militarySubordination: 55,
      },
      socialClasses: { extremePovertyPct: 25, povertyPct: 35, middlePct: 35, elitePct: 5 },
      initialCorruption: 25,
      baseApproval: 48,
      gdpBase: 80_000_000_000,
      povertyRate: 40,
      unemploymentRate: 15,
      inflation: 6,
      gini: 52,
      eventFrequencyMult: 1.2,
    },
    crisis_economica: {
      treasury: 500_000_000,
      population: 35_000_000,
      regimeMetrics: {
        powerConcentration: 35,
        pressFreedom: 60,
        judicialIndependence: 55,
        politicalPluralism: 60,
        civilLiberties: 58,
        transparency: 45,
        militarySubordination: 60,
      },
      socialClasses: { extremePovertyPct: 15, povertyPct: 30, middlePct: 48, elitePct: 7 },
      initialCorruption: 20,
      baseApproval: 35,
      gdpBase: 60_000_000_000,
      povertyRate: 25,
      unemploymentRate: 18,
      inflation: 18,
      gini: 48,
      eventFrequencyMult: 1.5,
    },
    post_conflicto: {
      treasury: 1_500_000_000,
      population: 25_000_000,
      regimeMetrics: {
        powerConcentration: 60,
        pressFreedom: 35,
        judicialIndependence: 30,
        politicalPluralism: 40,
        civilLiberties: 35,
        transparency: 25,
        militarySubordination: 40,
      },
      socialClasses: { extremePovertyPct: 30, povertyPct: 35, middlePct: 30, elitePct: 5 },
      initialCorruption: 35,
      baseApproval: 40,
      gdpBase: 30_000_000_000,
      povertyRate: 55,
      unemploymentRate: 22,
      inflation: 10,
      gini: 58,
      eventFrequencyMult: 1.8,
    },
  };

  const cfg = presets[preset];
  return {
    ...cfg,
    initialCorruption: Math.min(100, cfg.initialCorruption * diffMult),
    eventFrequencyMult: cfg.eventFrequencyMult * diffMult,
    baseApproval: Math.max(15, cfg.baseApproval - (diffMult - 1) * 10),
  };
}

export interface PartyData {
  name: string;
  ideology: { economic: number; social: number; authority: number };
  popularity: number;
  seatsLower: number;
  seatsUpper: number;
}

export function generateParties(): PartyData[] {
  return [
    {
      name: "Partido Conservador Nacional",
      ideology: { economic: 70, social: -50, authority: 40 },
      popularity: 22, seatsLower: 60, seatsUpper: 8,
    },
    {
      name: "Alianza Progresista",
      ideology: { economic: -40, social: 60, authority: -30 },
      popularity: 28, seatsLower: 80, seatsUpper: 10,
    },
    {
      name: "Union Democratica Social",
      ideology: { economic: 10, social: 20, authority: -10 },
      popularity: 20, seatsLower: 50, seatsUpper: 6,
    },
    {
      name: "Movimiento Obrero Popular",
      ideology: { economic: -80, social: 40, authority: -50 },
      popularity: 15, seatsLower: 35, seatsUpper: 4,
    },
    {
      name: "Frente Liberal Republicano",
      ideology: { economic: 60, social: -10, authority: -60 },
      popularity: 15, seatsLower: 35, seatsUpper: 4,
    },
  ];
}

export interface OfficialData {
  name: string;
  role: string;
  ideology: { economic: number; social: number; authority: number };
  loyalty: number;
  ambition: number;
  wealth: number;
  corruption: number;
  skill: number;
  reputation: number;
  partyId?: number;
}

export function generateOfficials(baseCorruption: number): OfficialData[] {
  const mult = baseCorruption / 9; // factor relativo a la corrupcion base
  return [
    ...Array.from({ length: 8 }, (_, i) => ({
      name: nombreAleatorio(i),
      role: "MINISTER",
      ideology: { economic: (i - 4) * 15, social: (i - 3) * 10, authority: (i - 5) * 8 },
      loyalty: 45 + Math.floor(Math.random() * 35),
      ambition: 15 + Math.floor(Math.random() * 35),
      wealth: 70000 + Math.floor(Math.random() * 180000),
      corruption: Math.min(100, Math.max(1, Math.round((4 + Math.floor(Math.random() * 11)) * mult))),
      skill: 55 + Math.floor(Math.random() * 30),
      reputation: 40 + Math.floor(Math.random() * 35),
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      name: nombreAleatorio(10 + i),
      role: "JUDGE",
      ideology: { economic: (i - 1) * 10, social: (i - 1) * 15, authority: (i - 1) * 15 },
      loyalty: 35 + Math.floor(Math.random() * 30),
      ambition: 20 + Math.floor(Math.random() * 30),
      wealth: 65000 + Math.floor(Math.random() * 40000),
      corruption: Math.min(100, Math.max(1, Math.round((3 + Math.floor(Math.random() * 12)) * mult))),
      skill: 55 + Math.floor(Math.random() * 30),
      reputation: 40 + Math.floor(Math.random() * 35),
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      name: nombreAleatorio(13 + i),
      role: "PROSECUTOR",
      ideology: { economic: (i - 1) * 10, social: (i - 1) * 10, authority: (i - 1) * 10 },
      loyalty: 35 + Math.floor(Math.random() * 30),
      ambition: 30 + Math.floor(Math.random() * 30),
      wealth: 55000 + Math.floor(Math.random() * 35000),
      corruption: Math.min(100, Math.max(1, Math.round((4 + Math.floor(Math.random() * 15)) * mult))),
      skill: 50 + Math.floor(Math.random() * 32),
      reputation: 38 + Math.floor(Math.random() * 35),
    })),
    {
      name: nombreAleatorio(16),
      role: "GENERAL",
      ideology: { economic: 40, social: -40, authority: 60 },
      loyalty: 60 + Math.round(Math.random() * 25),
      ambition: 30 + Math.round(Math.random() * 30),
      wealth: 200000 + Math.floor(Math.random() * 150000),
      corruption: Math.min(100, Math.max(1, Math.round(15 * mult))),
      skill: 60 + Math.floor(Math.random() * 25),
      reputation: 40 + Math.floor(Math.random() * 25),
    },
  ];
}

export interface MinistryData {
  key: string;
  budgetPercent: number;
  subDecisions: Record<string, number | boolean>;
}

export function generateMinistries(): MinistryData[] {
  return [
    { key: "HEALTH", budgetPercent: 14, subDecisions: { hospitalesPublicos: 60, vacunacion: true, saludMental: false } },
    { key: "EDUCATION", budgetPercent: 16, subDecisions: { primaria: 40, secundaria: 35, superior: 25, enfoqueSTEM: 60, becas: true } },
    { key: "ECONOMY", budgetPercent: 18, subDecisions: { tasaInteres: 4.5, salarioMinimo: 350, politicaIndustrial: 50 } },
    { key: "DEFENSE", budgetPercent: 10, subDecisions: { tropasActivas: 50000, gastoEquipamiento: 40, servicioMilitar: false } },
    { key: "SECURITY", budgetPercent: 12, subDecisions: { patrullajeUrbano: 60, politicaDrogas: 50, inversionCarceles: 30 } },
    { key: "JUSTICE", budgetPercent: 8, subDecisions: { juecesContratados: 200, prioridadCorrupcion: 60, durezaPenal: 50 } },
    { key: "AGRICULTURE", budgetPercent: 10, subDecisions: { subsidioPequenoProductor: 70, infraestructuraRural: 40 } },
    { key: "SOCIAL_DEVELOPMENT", budgetPercent: 12, subDecisions: { focalizacion: 60, prioridadNinos: 40, prioridadAdultosMayores: 35, prioridadMujeres: 25 } },
  ];
}

export interface SocialClassData {
  key: string;
  populationPercent: number;
  averageIncome: number;
  approval: number;
  demands: string[];
  educationLevel: number;
  healthAccess: number;
}

export function generateSocialClasses(cfg: PresetConfig): SocialClassData[] {
  return [
    {
      key: "EXTREME_POVERTY",
      populationPercent: cfg.socialClasses.extremePovertyPct,
      averageIncome: 150,
      approval: cfg.baseApproval - 15,
      demands: ["alimentacion", "empleo", "vivienda"],
      educationLevel: 15,
      healthAccess: 25,
    },
    {
      key: "POVERTY",
      populationPercent: cfg.socialClasses.povertyPct,
      averageIncome: 400,
      approval: cfg.baseApproval - 10,
      demands: ["empleo", "seguridad", "salud"],
      educationLevel: 30,
      healthAccess: 45,
    },
    {
      key: "MIDDLE",
      populationPercent: cfg.socialClasses.middlePct,
      averageIncome: 2000,
      approval: cfg.baseApproval,
      demands: ["estabilidad", "educacion", "libertad economica"],
      educationLevel: 65,
      healthAccess: 70,
    },
    {
      key: "ELITE",
      populationPercent: cfg.socialClasses.elitePct,
      averageIncome: 15000,
      approval: cfg.baseApproval - 5,
      demands: ["libertad economica", "baja tributacion", "seguridad juridica"],
      educationLevel: 90,
      healthAccess: 95,
    },
  ];
}

export interface MediaData {
  name: string;
  type: string;
  ideologicalAffinity: { economic: number; social: number; authority: number };
  reach: number;
  credibility: number;
  governmentAffinity: number;
}

export function generateMedia(): MediaData[] {
  return [
    {
      name: "Canal Nacional",
      type: "TV",
      ideologicalAffinity: { economic: 20, social: -10, authority: 30 },
      reach: 70, credibility: 40, governmentAffinity: 60,
    },
    {
      name: "El Independiente",
      type: "NEWSPAPER",
      ideologicalAffinity: { economic: 0, social: 30, authority: -20 },
      reach: 50, credibility: 75, governmentAffinity: 0,
    },
    {
      name: "Voz Ciudadana Digital",
      type: "DIGITAL",
      ideologicalAffinity: { economic: -30, social: 50, authority: -50 },
      reach: 45, credibility: 55, governmentAffinity: -40,
    },
  ];
}

export const LAW_CATALOG = [
  { key: "subsidio-alimentario", name: "Subsidio Alimentario", description: "Programa de subsidio directo para alimentos basicos a familias de bajos recursos.", effectsJson: { povertyRate: -5, approval: { EXTREME_POVERTY: 8, POVERTY: 4, MIDDLE: -1, ELITE: -2 } }, idealIdeology: { economic: -60, social: 40, authority: -10 }, cost: 500000000 },
  { key: "impuesto-progresivo", name: "Impuesto Progresivo a la Renta", description: "Sistema impositivo donde los que mas ganan pagan mayor porcentaje.", effectsJson: { taxRevenue: 15, approval: { EXTREME_POVERTY: 5, POVERTY: 3, MIDDLE: 0, ELITE: -8 }, gini: -3 }, idealIdeology: { economic: -70, social: 30, authority: 0 }, cost: 0 },
  { key: "ley-anticorrupcion", name: "Ley Anticorrupcion Integral", description: "Endurece penas por corrupcion y crea mecanismos de control.", effectsJson: { corruption: -10, transparency: 15, approval: { EXTREME_POVERTY: 3, POVERTY: 3, MIDDLE: 5, ELITE: -2 } }, idealIdeology: { economic: 0, social: 30, authority: 0 }, cost: 200000000 },
  { key: "servicio-militar-obligatorio", name: "Servicio Militar Obligatorio", description: "Establece el servicio militar obligatorio para jovenes de 18 anios.", effectsJson: { defenseEfficiency: 10, approval: { EXTREME_POVERTY: -2, POVERTY: -5, MIDDLE: -3, ELITE: 2 }, civilLiberties: -5 }, idealIdeology: { economic: 20, social: -30, authority: 50 }, cost: 300000000 },
  { key: "educacion-publica-gratuita", name: "Educacion Publica Gratuita Universal", description: "Garantiza acceso gratuito a todos los niveles educativos.", effectsJson: { educationLevel: 15, approval: { EXTREME_POVERTY: 8, POVERTY: 7, MIDDLE: 5, ELITE: -1 } }, idealIdeology: { economic: -30, social: 60, authority: 0 }, cost: 800000000 },
  { key: "salud-universal", name: "Sistema de Salud Universal", description: "Cobertura medica garantizada para todos los ciudadanos.", effectsJson: { sickRate: -8, approval: { EXTREME_POVERTY: 10, POVERTY: 8, MIDDLE: 6, ELITE: -1 } }, idealIdeology: { economic: -40, social: 50, authority: 0 }, cost: 1000000000 },
  { key: "liberalizacion-economica", name: "Liberalizacion Economica", description: "Reduce regulaciones, aranceles y barreras comerciales.", effectsJson: { gdp: 10, taxRevenue: -5, approval: { EXTREME_POVERTY: -5, POVERTY: -3, MIDDLE: 2, ELITE: 8 }, gini: 5 }, idealIdeology: { economic: 80, social: -20, authority: -30 }, cost: 0 },
  { key: "estado-emergencia", name: "Estado de Emergencia Nacional", description: "Otorga poderes especiales al ejecutivo para manejar crisis.", effectsJson: { civilLiberties: -15, powerConcentration: 10, approval: { EXTREME_POVERTY: 0, POVERTY: -2, MIDDLE: -5, ELITE: 5 } }, idealIdeology: { economic: 30, social: -40, authority: 80 }, cost: 100000000 },
  { key: "reforma-judicial", name: "Reforma del Poder Judicial", description: "Reestructura el sistema judicial para mayor independencia.", effectsJson: { judicialIndependence: 20, corruption: -5, approval: { EXTREME_POVERTY: 2, POVERTY: 3, MIDDLE: 5, ELITE: 0 } }, idealIdeology: { economic: 0, social: 40, authority: -20 }, cost: 400000000 },
  { key: "ley-transparencia", name: "Ley de Transparencia y Acceso a la Informacion", description: "Obliga al gobierno a publicar todos sus actos y gastos.", effectsJson: { transparency: 20, corruption: -8, approval: { EXTREME_POVERTY: 2, POVERTY: 3, MIDDLE: 6, ELITE: 2 } }, idealIdeology: { economic: -10, social: 50, authority: -30 }, cost: 100000000 },
  { key: "libertad-prensa", name: "Libertad de Prensa Garantizada", description: "Prohibe la censura estatal y protege a periodistas.", effectsJson: { pressFreedom: 25, approval: { EXTREME_POVERTY: 1, POVERTY: 3, MIDDLE: 7, ELITE: 4 } }, idealIdeology: { economic: -20, social: 70, authority: -50 }, cost: 50000000 },
  { key: "censura-medios", name: "Ley de Regulacion de Contenidos Mediaticos", description: "Permite al gobierno controlar contenidos 'perjudiciales' en medios.", effectsJson: { pressFreedom: -20, powerConcentration: 10, approval: { EXTREME_POVERTY: -1, POVERTY: -3, MIDDLE: -8, ELITE: 2 } }, idealIdeology: { economic: 30, social: -60, authority: 70 }, cost: 50000000 },
  { key: "reforma-constitucional", name: "Reforma Constitucional", description: "Modifica articulos clave de la constitucion para cambiar el equilibrio de poderes.", effectsJson: { powerConcentration: 15, judicialIndependence: -10, politicalPluralism: -5, approval: { EXTREME_POVERTY: -2, POVERTY: -3, MIDDLE: -6, ELITE: 5 } }, idealIdeology: { economic: 10, social: -20, authority: 60 }, cost: 100000000 },
  { key: "despenalizacion-aborto", name: "Despenalizacion del Aborto", description: "Elimina las sanciones penales por interrupcion del embarazo.", effectsJson: { approval: { EXTREME_POVERTY: -1, POVERTY: 0, MIDDLE: 5, ELITE: 3 }, civilLiberties: 10 }, idealIdeology: { economic: -10, social: 80, authority: -30 }, cost: 0 },
  { key: "ley-antimonopolios", name: "Ley Anti-Monopolios y Competencia", description: "Impide la concentracion excesiva de mercado y promueve competencia.", effectsJson: { gdp: 5, gini: -4, approval: { EXTREME_POVERTY: 3, POVERTY: 4, MIDDLE: 3, ELITE: -6 } }, idealIdeology: { economic: -30, social: 20, authority: 0 }, cost: 150000000 },
];
