import { createContext, useContext } from "react";

export type AuthorChannelNav = {
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
};

const AuthorChannelNavContext = createContext<AuthorChannelNav | null>(null);

export const AuthorChannelNavProvider = AuthorChannelNavContext.Provider;

export function useAuthorChannelNav(): AuthorChannelNav | null {
  return useContext(AuthorChannelNavContext);
}
