import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/lib/amplify-client'; // Amplify クライアントの初期化

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'おみくじエージェント - AWS Bedrock AgentCore',
  description: 'AIがあなたの運勢を占います！',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
