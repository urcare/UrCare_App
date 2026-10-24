// Copies the Lottie player engine (WASM) into public/, so the app loads it
// from its own server instead of a public CDN. Runs before dev and build.
import { copyFileSync, mkdirSync } from 'fs';
mkdirSync('public/lottie', { recursive: true });
copyFileSync('node_modules/@lottiefiles/dotlottie-web/dist/dotlottie-player.wasm', 'public/lottie/dotlottie-player.wasm');
