import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import { allFlags } from "../../../flags";

export const GET = createFlagsDiscoveryEndpoint(() =>
  getProviderData(Object.fromEntries(allFlags.map((f) => [f.key, f]))),
);
