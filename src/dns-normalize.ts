function normalizeDnsHostname(options: { value: string }): string {
  return options.value.toLowerCase().trim().replace(/\.$/, "");
}

function normalizeTxtValue(options: { value: string }): string {
  let result = "";
  let inQuotes = false;
  let foundQuotedSegment = false;
  let i = 0;

  while (i < options.value.length) {
    const char = options.value[i];
    const nextChar = options.value[i + 1];

    if (char === "\\" && nextChar !== undefined) {
      if (inQuotes) {
        result += nextChar;
      }
      i += 2;
      continue;
    }

    if (char === '"') {
      if (!inQuotes) {
        foundQuotedSegment = true;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (inQuotes) {
      result += char;
    }

    i += 1;
  }

  return foundQuotedSegment ? result : options.value;
}

export { normalizeDnsHostname, normalizeTxtValue };
