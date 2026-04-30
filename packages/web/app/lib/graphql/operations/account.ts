import { graphql } from '@/app/lib/graphql/generated';

export const GET_DELETE_ACCOUNT_INFO = graphql(`
  query GetDeleteAccountInfo {
    deleteAccountInfo {
      publishedClimbCount
    }
  }
`);

export const DELETE_ACCOUNT = graphql(`
  mutation DeleteAccount($input: DeleteAccountInput!) {
    deleteAccount(input: $input)
  }
`);
