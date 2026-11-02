# Review copy

Preparation for issue #6. Publication and cleanup still need separate human
approval; this document does not authorize either. Leave the issue and plan open.

From the repository root with dependencies installed and Node 24:

```sh
bash scripts/export-preview.sh
# Optional output path and separate local port:
PORT=18788 bash scripts/export-preview.sh var/previews/alternate.html
```

The default copy is `var/previews/index.html`. The script loads the existing `.env`,
keeps its marker, checks health with bounded retries, fetches the sample digest,
validates five rows, inline style and banner, and rejects scripts and external
resources. It stops its single Node process on exit. Server logs and heartbeat
stay under ignored `var/`. Never commit or attach previews, logs, `.env`, or markers.

After explicit approval of repository settings, secret installation and deployment:

1. Merge the reviewed workflow to the default branch so manual dispatch is available.
2. Enable Pages with **GitHub Actions** as its source. Check the `github-pages`
   environment's deployment branch rules allow the selected ref.
3. Set a repository Actions secret named `LANE_MARKER` through GitHub's secret UI;
   never paste its value in source, commands, issues, or logs.
4. Manually run **Review preview**, selecting the reviewed ref and `with_marker: true`.
   It fails if the secret is missing. The secret is available only to the export
   step. Tests and typechecking precede export; only the generated temporary
   directory is uploaded as a Pages artifact, retained for one day.
5. Verify the public HTTPS URL from the deployment, then send that URL and the
   plan's issues (#1–#7) to the reviewer. Keep #6 open until the reviewer has
   looked; a submission acknowledgment alone does not complete review.

After review and separate cleanup approval, run the same workflow with
`with_marker: false` (the default). It exports an empty marker environment value,
so the banner reads **no marker set**, and replaces the page at the same Pages URL.
Verify the public banner before completing cleanup issue #7 and archiving the plan.
Artifact expiry does not remove the deployed site; cleanup requires this deployment.

The workflow has only `workflow_dispatch`; pushes do not publish. It follows
[GitHub's custom Pages workflow reference](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
