// @ts-nocheck — Seed script: crea el catalogo global de leyes.
// Ya no crea usuario demo ni partida demo — el registro es via /registro
// y las partidas se crean desde el wizard autenticado.
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed (catalogo de leyes)...");

  await prisma.lawCatalog.deleteMany();

  const leyes = [
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

  for (const ley of leyes) {
    await prisma.lawCatalog.create({ data: ley });
  }
  console.log(`  ✓ ${leyes.length} leyes en catalogo`);

  console.log("\n✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
