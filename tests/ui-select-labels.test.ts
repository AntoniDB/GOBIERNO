import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

// Los Select de Base UI muestran el valor crudo (un id o una clave) si no reciben `items`
// (mapa valor → etiqueta). Issue 19: el titular de un organismo salía como su UUID. Este test
// falla si un archivo usa <SelectValue> con algún <Select> raíz sin `items`.

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : /\.tsx$/.test(nombre) ? [ruta] : [];
  });
}

const raiz = join(__dirname, "..", "src", "components");
const conSelectValue = archivos(raiz).filter(
  (f) => !f.endsWith(join("ui", "select.tsx")) && readFileSync(f, "utf-8").includes("<SelectValue"),
);

describe("los desplegables muestran etiquetas, no ids", () => {
  it("encuentra los archivos con SelectValue", () => {
    expect(conSelectValue.length).toBeGreaterThan(0);
  });

  it.each(conSelectValue.map((f) => [f.replace(raiz, "components")]))("%s: cada <Select> recibe items", (ruta) => {
    const codigo = readFileSync(join(raiz, "..", ruta), "utf-8");
    const selects = [...codigo.matchAll(/<Select(?=[\s>])([^>]*)>/g)];
    expect(selects.length).toBeGreaterThan(0);
    for (const [, atributos] of selects) expect(atributos, "falta items={…} en un <Select>").toMatch(/\bitems=/);
  });
});
