/** Auto-audit helper — binds actor to JWT user */
export function createAuditHelper({ putState, commitBlock = () => {}, broadcast, randomUUID, network }) {
  return function logAudit(req, { resource, action, outcome = "success", severity = "info" }) {
    const actor = req.user?.email || req.user?.did || "system";
    const txId = randomUUID();
    const event = {
      txId,
      actor,
      actorDid: req.user?.did || null,
      resource,
      action,
      outcome,
      severity,
      loggedAt: new Date().toISOString(),
    };
    putState("audit", `audit_${txId}`, event, txId);
    commitBlock({
      txId,
      module: "audit",
      fcn: "logEvent",
      args: [actor, resource, action, outcome],
      status: "VALID",
      timestamp: new Date().toISOString(),
      network: network,
      creator: actor,
    });
    broadcast({ event: "audit:logged", data: event });
    return event;
  };
}
