export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-primary">
          Simulador de Gobierno
        </h1>
        <p className="text-muted-foreground">
          <a href="/dashboard" className="text-primary hover:underline">
            Entrar al Panel de Control
          </a>
        </p>
      </div>
    </main>
  );
}
