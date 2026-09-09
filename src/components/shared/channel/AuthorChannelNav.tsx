import { createContext, useContext } from "react";

export type ChannelEditFocus = {
  key: string;
  groupId: string | null;
};

export type AuthorChannelNav = {
  openChannelEditor: (focus: ChannelEditFocus) => void;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
};

const AuthorChannelNavContext = createContext<AuthorChannelNav | null>(null);

export const AuthorChannelNavProvider = AuthorChannelNavContext.Provider;

export function useAuthorChannelNav(): AuthorChannelNav | null {
  return useContext(AuthorChannelNavContext);
}
