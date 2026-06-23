import type { Metadata } from "next";
import { Barlow_Condensed, Share_Tech_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: ["400", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const shareTechMono = Share_Tech_Mono({
  variable: "--font-share-tech-mono",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Simulador de Gobierno",
  description: "Simulador de gobierno y sociedad — toma el control de un país",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${barlowCondensed.variable} ${shareTechMono.variable} antialiased`}>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
