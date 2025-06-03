export default {
  extends: [
    // "stylelint-config-standard", // Standard CSS linting rules (more strict styling)
    "stylelint-config-recommended", // only essential linting rules (less strict)
    "stylelint-config-tailwindcss", // Tailwind-specific linting rules
    // "stylelint-config-html",
  ],
  rules: {
    // Add any custom rules here
    // "indentation": 2,
    // "string-quotes": "double",
    // "no-empty-source": null,
    "declaration-block-no-duplicate-properties": true,
    "property-no-unknown": true,
    "no-unknown-custom-properties": true,
    "at-rule-empty-line-before": null,
    "comment-empty-line-before": null,
    "no-descending-specificity": null,

    // "rule-empty-line-before": null,
  },
  ignoreFiles: ["stylelint.config.mjs"],
};
