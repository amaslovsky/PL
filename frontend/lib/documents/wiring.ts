// Component wiring for the document registry.
//
// `registry.ts` is pure data so it can be unit-tested without pulling in
// React. This file attaches the React components each entry needs:
//   - `wired: true`   entries get a `Workspace` that fills fields
//   - `wired: false`  entries get an `Unsupported` fallback
//
// Importing this module from a server component (the dynamic route) is
// safe: the registry wraps the imports and the server-side renderer
// passes the resolved React element into the RSC payload. No client-only
// APIs are touched at import time.

import { NdaWorkspace } from "@/components/NdaWorkspace";
import { UnsupportedDocWorkspace } from "@/components/UnsupportedDocWorkspace";
import { REGISTRY } from "./registry";

for (const entry of REGISTRY) {
  if (entry.id === "mnda") {
    entry.Workspace = NdaWorkspace;
  } else {
    entry.Unsupported = UnsupportedDocWorkspace;
  }
}

export { REGISTRY, getDocument, listDocuments } from "./registry";