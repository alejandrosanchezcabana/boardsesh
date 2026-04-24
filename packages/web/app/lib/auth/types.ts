import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  // eslint-disable-next-line typescript/consistent-type-definitions
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
