// ESLint flat config. `next lint` is deprecated and was never set up here (it
// only prompted for a config and exited 1), so lint ran nothing. Next 15's own
// configs are still eslintrc-style, so FlatCompat bridges them; switch to the
// native flat exports with the Next 16 upgrade. Mirrors realestate-witus.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "src/db/migrations/**", "plans/**"],
  },
];

export default eslintConfig;
