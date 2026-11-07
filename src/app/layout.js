import { Inter } from "next/font/google";
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});
export const metadata = {
  title: "KING SABLON ERP",
  description: "Internal ERP System for King Sablon Nusantara",
};

import { ThemeProvider } from "@/components/ThemeProvider";
import { CustomAlertProvider } from "@/components/CustomAlertProvider";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased min-h-screen bg-background`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <CustomAlertProvider>
            <NextTopLoader color="#a855f7" showSpinner={false} height={3} />
            {children}
          </CustomAlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
