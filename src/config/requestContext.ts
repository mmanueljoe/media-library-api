import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = {
    requestId: string;
};

/**
 * Holds the current request's id for the lifetime of that request, including
 * across awaits. The alternative was threading a child logger through every
 * function signature, or passing `req` into services that have no business
 * knowing about HTTP — this keeps the correlation id out of the call graph
 * entirely, and the logger picks it up via a mixin.
 */
const storage = new AsyncLocalStorage<RequestContext>();

export const runWithRequestContext = <T>(context: RequestContext, fn: () => T): T =>
    storage.run(context, fn);

export const getRequestId = (): string | undefined => storage.getStore()?.requestId;
