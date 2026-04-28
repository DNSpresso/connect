import { z } from "zod";

const ipv6AddressSchema = z.ipv6();

type Ipv6Address = string & { readonly __brand: "Ipv6Address" };

function normalizeIpv6Address(options: { value: string }): Ipv6Address | undefined {
  const result = ipv6AddressSchema.safeParse(options.value);
  if (!result.success) {
    return undefined;
  }

  try {
    const parsed = new URL(`http://[${result.data}]/`);
    return parsed.hostname.slice(1, -1) as Ipv6Address;
  } catch {
    return undefined;
  }
}

export { normalizeIpv6Address };
export type { Ipv6Address };
