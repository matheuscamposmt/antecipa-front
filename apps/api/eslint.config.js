import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts"],
  languageOptions: {
    parserOptions: {
      project: "./tsconfig.json",
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
});
