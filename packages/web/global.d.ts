/// <reference types="web-bluetooth" />

// Side-effect CSS imports — Next.js bundles these at build time but TS needs an
// ambient declaration. Next's own types only cover *.module.css, not bare *.css.
declare module '*.css';
