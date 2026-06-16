import localFont from "next/font/local";
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "KING SABLON ERP",
  description: "Internal ERP System for King Sablon Nusantara",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
        <NextTopLoader color="#a855f7" showSpinner={false} height={3} />
        {children}
      </body>
    </html>
  );
}
