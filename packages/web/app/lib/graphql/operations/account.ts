import { gql } from 'graphql-request';
import type { DeleteAccountInfo } from '@boardsesh/shared-schema';

export const GET_DELETE_ACCOUNT_INFO = gql`
  query GetDeleteAccountInfo {
    deleteAccountInfo {
      publishedClimbCount
    }
  }
`;

export type GetDeleteAccountInfoResponse = {
  deleteAccountInfo: DeleteAccountInfo;
};

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($input: DeleteAccountInput!) {
    deleteAccount(input: $input)
  }
`;

export type DeleteAccountResponse = {
  deleteAccount: boolean;
};
