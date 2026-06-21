export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary">
          Simulador de Gobierno
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Toma el control de un pais. Gestiona ministerios, promulga leyes,
          combate la corrupcion y enfrenta las consecuencias de tus decisiones.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/registro"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Crear cuenta
          </a>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors text-foreground"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    </main>
  );
}
