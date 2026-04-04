import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
<<<<<<< HEAD
import { ThemeProvider } from "./components/theme-provider";
import { MotionConfig } from "framer-motion";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </ThemeProvider>,
);
=======

createRoot(document.getElementById("root")!).render(<App />);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
