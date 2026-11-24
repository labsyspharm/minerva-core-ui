import { createContext, useContext } from "react";

export type AuthorChannelNav = {
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  /** False when contrast is baked into the pixels (JPEG stories): no editor. */
  contrastEditable?: boolean;
};

const AuthorChannelNavContext = createContext<AuthorChannelNav | null>(null);

export const AuthorChannelNavProvider = AuthorChannelNavContext.Provider;

export function useAuthorChannelNav(): AuthorChannelNav | null {
  return useContext(AuthorChannelNavContext);
}
