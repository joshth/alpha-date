export function prepareSafetyInput(text: string): string {
  return text.trim().replace(/\s+/g, (whitespace) =>
    /[\r\n\u2028\u2029]/.test(whitespace) ? "\n" : " ")
}
