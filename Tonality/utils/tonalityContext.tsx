import React, { createContext } from 'react';

type SpotifyUser = {
  display_name: string;
  email: string;
  external_urls: { spotify: string; };
  followers: { href: string | null; total: number;};
  href: string;
  id: string;
  images: { height: number; url: string; width: number;
  }[];
  type: string;
  uri: string;
};

type TonalityContextType = {
  profile: SpotifyUser | null;
  setProfile: React.Dispatch<React.SetStateAction<SpotifyUser | null>>;
};

export const tonalityContext = createContext<TonalityContextType | undefined>(
  undefined
);

const TonalityProvider = ({ children }: { children: React.ReactNode }) => {
    const [profile, setProfile] = React.useState<SpotifyUser | null>(null);
  return (
    <tonalityContext.Provider value={{profile, setProfile}}>
        {children}
    </tonalityContext.Provider>
  );
}
export default  TonalityProvider;