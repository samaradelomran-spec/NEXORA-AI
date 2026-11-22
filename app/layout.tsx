import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXORA AI — منصة الإبداع بالذكاء الاصطناعي",
  description: "مساحة عمل واحدة لإنشاء المواقع والتطبيقات والألعاب والصور والفيديو والصوت باستخدام الذكاء الاصطناعي."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
