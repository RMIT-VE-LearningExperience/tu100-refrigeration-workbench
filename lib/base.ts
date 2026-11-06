/** Public base path of the deployed site ('' at a domain root, '/<repo>' on a GitHub project page).
 * Inlined at build time from next.config.ts; use it for every root-absolute asset URL. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
export const asset = (path: string) => BASE_PATH + path;
