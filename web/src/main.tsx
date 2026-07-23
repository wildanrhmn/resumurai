import { ViteReactSSG } from "vite-react-ssg/single-page";
import App from "./App";
import "./index.css";

// Single-page SSG: pre-rendered to static HTML at build (SEO + fast first paint),
// then hydrated for the interactive TryConsole.
export const createRoot = ViteReactSSG(<App />);
