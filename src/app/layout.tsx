import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const THEME_STORAGE_KEY = "cron-mini-manager-theme";

const setInitialThemeScript = `(() => {
  const root = document.documentElement;
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  let resolvedTheme = systemPrefersDark ? "dark" : "light";

  try {
    const storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
    if (storedTheme === "light" || storedTheme === "dark") {
      resolvedTheme = storedTheme;
    }
  } catch {
    resolvedTheme = systemPrefersDark ? "dark" : "light";
  }

  root.dataset.theme = resolvedTheme;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cron Mini Manager",
  description: "Web-based cron job manager for this Mac mini",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: setInitialThemeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
