import { createHashRouter, RouterProvider } from "react-router";
import { Homepage } from "./Homepage";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { EditorWrapper } from "./editor/EditorWrapper";

const router = createHashRouter([
  {
    path: "/",
    element: <Homepage />,
  },
  {
    path: "/editor",
    element: <EditorWrapper></EditorWrapper>,
  },
]);

export function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
}
