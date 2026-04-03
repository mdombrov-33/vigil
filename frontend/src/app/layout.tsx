import type { Metadata } from "next";
import { Geist_Mono, Geist } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIGIL SDN",
  description: "Superhero Dispatch Network",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", geistMono.variable, "font-sans", geist.variable)}>
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
