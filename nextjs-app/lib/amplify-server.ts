import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import outputs from '@/amplify_outputs.json';

// Server-Side で使う Amplify 設定
export const { runWithAmplifyServerContext } = createServerRunner({
  config: outputs,
});
