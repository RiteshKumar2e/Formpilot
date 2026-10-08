/**
 * The browser extension's field detection and filling, used by the in-app "Use Anywhere" demo.
 * The code lives with the extension (frontend/extension/src/core) so the demo and the real extension
 * run exactly the same logic.
 */
export { detectFields, toMeta, signature, type DetectedField, type FieldElement, type FieldMeta } from '../../../extension/src/core/field-detector'
export { attachFile, fill, formatDateFor, highlight, setNativeValue, type FillRequest } from '../../../extension/src/core/autofill-engine'
