export function interpolateTranslation(text, params) {
  if (!params) return text
  return text.replace(/\{([\w]+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  )
}
