# Coordinator lock integrity

The Engineering OS coordinator serializes claims-store writes with an atomic
.claims.lock directory. A per-acquisition random token is written beside the
owner PID and timestamp. Only the matching PID/token pair may release the lock.

Lock age is diagnostic, not proof that its owner process has stopped. The
coordinator therefore never deletes a lock solely because its mtime crossed the
stale window. An over-age lock fails closed with an actionable error. Manual
recovery requires inspecting .claims.lock/owner.json and independently verifying
that the owning process is no longer running. This is especially important when
state is shared across hosts, where a PID alone is not globally unique.

Regression tests retain an artificially old lock held by a live process and
assert that a competing claim is rejected while the lock directory remains.
