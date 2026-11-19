"use client";

import type { ReactNode } from "react";
import { Reshaped } from "reshaped";
import "reshaped/themes/slate/theme.css";

import { SessionProvider } from "@/lib/auth/client";

const App = ({ children }: { children: ReactNode }) => {
  return (
    <Reshaped theme="slate" defaultColorMode="dark">
      <SessionProvider>{children}</SessionProvider>
    </Reshaped>
  );
};

export default App;