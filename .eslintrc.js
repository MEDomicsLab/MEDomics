module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ["eslint:recommended", "plugin:react/recommended", "next"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["react"],
  rules: {
    camelcase: ["error"],
    "quote-props": ["error", "consistent"],
    "react/prop-types": ["off"],
    "no-mixed-spaces-and-tabs": ["error", "smart-tabs"],
    "react/no-unescaped-entities": "off",
    "@next/next/no-page-custom-font": "off",
    "react-hooks/exhaustive-deps": "off",
    "@next/next/no-img-element": "off",
    "jsx-a11y/role-supports-aria-props": "off",
    "@next/next/no-img-element": "off",
    "react/no-direct-mutation-state": "off",

    //Todo: delete those checks 
    'no-unused-vars': 'off',
    'quote-props': 'off',
    'no-undef': 'off',
    'camelcase': 'off',
    'react/jsx-key': 'off',
  },
}
