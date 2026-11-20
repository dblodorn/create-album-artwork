"use client";

import type { ReactNode } from "react";

import { ColorModeProvider } from "@/design";
import { SessionProvider } from "@/lib/auth/client";

const App = ({ children }: { children: ReactNode }) => {
  return (
    <ColorModeProvider>
      <SessionProvider>{children}</SessionProvider>
    </ColorModeProvider>
  );
};

export default App;
