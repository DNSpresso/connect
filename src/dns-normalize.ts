function normalizeDnsHostname(options: { value: string }): string {
  return options.value.toLowerCase().trim().replace(/\.$/, "");
}

function normalizeTxtValue(options: { value: string }): string {
  const matches = [...options.value.matchAll(/"([^"]*)"/g)].map((match) => match[1] ?? "");

  if (matches.length > 0) {
    return matches.join("");
  }

  return options.value.replaceAll(/^"|"$/g, "");
}

export { normalizeDnsHostname, normalizeTxtValue };
