# Canonical Gen2 source and legacy recovery

The current operational membros contracts are versioned in geapaufmt/geapa-core, under members/, shared/core/ and backend/functions-node/. Review: https://github.com/geapaufmt/geapa-core/pull/25 . The companion Portal review is https://github.com/geapaufmt/geapa-portal/pull/33 .

This repository preserves the previous Apps Script implementation and its history for compatibility and recovery of operations owned by that executor. It is not a parallel authority for new canonical facts. Do not deploy its older default branch over the current composed Core, and do not copy/edit the canonical rules into a second runtime here.

No source deletion, merge, deployment, data migration or change of active routes is made by this documentation. Future domain edits should target the canonical paths and then the generated, verified release. Credentials, private evidence and institutional manifests remain outside public Git.
