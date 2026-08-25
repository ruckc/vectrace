// The whole app prerenders to plain files for GitHub Pages. SSR stays on so the
// prerendered HTML carries the full head (title, description, social cards) and page
// content for crawlers — all actual work still happens client-side in a worker.
export const prerender = true;
