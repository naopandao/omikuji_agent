'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

// Amplify クライアントの設定
Amplify.configure(outputs, {
  ssr: true, // Server-Side Rendering を有効化
});

export default Amplify;
