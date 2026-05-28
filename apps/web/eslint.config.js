import { nextJsConfig } from "@workspace/eslint-config/next-js"

/**
 * Custom rule: warn on Tailwind classes that use *physical* writing-direction
 * properties (e.g. `ml-4`, `pl-2`, `left-0`, `text-left`). SPEC.md §3 requires
 * exclusively *logical* properties (`ms-*`, `pe-*`, `start-*`, `text-start`)
 * so the layout flips correctly between Arabic (RTL) and English (LTR).
 *
 * Implemented as a `no-restricted-syntax` matcher on string Literals and on
 * the static parts of template literals — covers the two ways a Tailwind class
 * lands in source code (`className="..."` and `clsx(\`...\`)`). To minimise
 * false positives, we only match when the disallowed token is **surrounded
 * by whitespace, string boundaries, or a colon** (so utilities like
 * `marquee-left-to-right` or arbitrary CSS values that happen to contain
 * "left" don't trip the rule).
 *
 * Selector grammar (per https://eslint.org/docs/latest/extend/selectors):
 *   Literal[value=/.../i]              — JSX string attributes, cn("...") args
 *   TemplateElement[value.raw=/.../i]  — template literal static fragments
 */
const PHYSICAL_TAILWIND_PATTERN =
  "(^|[\\s'\\\"`(:])((m|p)[lr]-|text-(left|right)(\\s|$|['\\\"`)])|(left|right)-)"

const NO_PHYSICAL_TAILWIND_MESSAGE =
  "Use Tailwind logical properties (ms-/me-, ps-/pe-, start-/end-, text-start/text-end) instead of physical writing-direction utilities. See SPEC.md §3."

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // The rule itself is implemented in this config file, which by design
    // contains the literal tokens it forbids. Skip linting on the config file.
    ignores: ["eslint.config.js"],
  },
  {
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: `Literal[value=/${PHYSICAL_TAILWIND_PATTERN}/]`,
          message: NO_PHYSICAL_TAILWIND_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${PHYSICAL_TAILWIND_PATTERN}/]`,
          message: NO_PHYSICAL_TAILWIND_MESSAGE,
        },
      ],
    },
  },
]
