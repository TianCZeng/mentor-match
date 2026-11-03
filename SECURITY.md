# Security Policy

mentor-match runs on your machine and keeps everything as plain files in your own clone. It has no server, no account and no telemetry. Its security is therefore about **data**: your own, and that of the people it records.

## Do not put personal data in public places

A working clone holds two kinds of personal data. Your profile, your project brief and your fellowship records are yours. `registry/researchers.yml`, the pool, the summaries and the recommendations are about **named people who did not agree to be catalogued**.

- **Never paste any of it into a public issue, pull request or discussion.** That includes a single researcher row, a report excerpt that names someone, a `fit` or `host_strength` call, and your own profile or brief. Reproduce a problem with the fictional fixtures under `examples/`, whose people and institutions are invented and sit on `example.*` domains, or with data you make up.
- **Never commit a workspace to a public repository.** `.gitignore` keeps `config.yml`, `applicants/`, `fellowships/` and both local registries out of git. Keep it that way, and keep a clone you use for a real application private.
- **What you work on is sent to your agent's model provider**: your brief, your profile and the pages the agent reads. Read that provider's privacy and retention terms before you use it for a real application.

## Reporting a vulnerability or an accidental exposure

Report privately, and **do not open a public issue**, for:

- a guard that can be made to pass what it should refuse: a researcher row with a field outside the closed set, a contact address off the institution's domain, a page the gate should block, a metric without its source and date;
- a path that lets a command read or write outside the repository root;
- personal data published in this repository or its history;
- anything else you would not want disclosed before it is fixed.

**How:** on the repository's **Security** tab, choose **Report a vulnerability**. This opens a private advisory that only the maintainer sees. Say what you found, how to reproduce it, and what you expect the impact to be. Describe personal data rather than including it.

This is a small project maintained in spare time, with no formal response time. Reports of exposed personal data come first.

## If you exposed data in your own copy

If you pushed a workspace to a public repository, deleting the files in a new commit is **not** enough: they stay in the git history. Make the repository private at once, then rewrite its history (for example with `git filter-repo`), or delete it and start again from a fresh clone.

## Supported versions

Only the latest `main` is supported.
