import { z } from "zod";

import { ConnectError } from "./connect-error";

const domainNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/\.$/, ""))
  .pipe(
    z
      .hostname()
      .max(253)
      .refine((value) => value.includes("."), {
        error: "Domain must include at least one dot",
      }),
  );

type DomainName = string & { readonly __brand: "DomainName" };

type ParseDomainNameResult =
  | { readonly status: "success"; readonly domain: DomainName }
  | { readonly status: "invalid-domain"; readonly error: ConnectError };

function parseDomainName(options: { value: string }): ParseDomainNameResult {
  const result = domainNameSchema.safeParse(options.value);

  if (!result.success) {
    return {
      status: "invalid-domain",
      error: new ConnectError("INVALID_DOMAIN", `Invalid domain: ${options.value}`),
    };
  }

  return { status: "success", domain: result.data as DomainName };
}

function assertDomainName(options: { value: string }): DomainName {
  const result = parseDomainName(options);
  if (result.status === "invalid-domain") {
    throw result.error;
  }

  return result.domain;
}

export { assertDomainName, parseDomainName };
export type { DomainName, ParseDomainNameResult };
