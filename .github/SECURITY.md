# Security Policy

## Supported versions

ProSlides is pre-production and currently developed from the `main` branch. It
does not yet maintain versioned production release lines.

| Version | Supported |
| --- | --- |
| Current `main` / controlled validation deployments | Yes |
| Historical archive tags and older snapshots | No |

Security fixes are applied to the current codebase. Backports are not guaranteed
until the project adopts a versioned release-support policy.

## Reporting a vulnerability

Please do not disclose security vulnerabilities in public issues, pull
requests, discussions, screenshots, or logs.

Use GitHub private vulnerability reporting for this repository:

1. Open the repository's **Security** page.
2. Open **Advisories**.
3. Choose **Report a vulnerability**.
4. Provide enough detail for maintainers to reproduce and assess the issue.

A useful report includes:

- the affected component or endpoint;
- the security impact and realistic attack scenario;
- prerequisites or permissions required;
- reproducible steps or a minimal proof of concept;
- affected versions or commits, when known;
- any mitigation or fix you have already identified.

If private vulnerability reporting is unavailable, contact the repository owner
through GitHub without including vulnerability details and request a private
reporting channel.

## Response process

We aim to acknowledge a new report within five business days. This is a target,
not a service-level guarantee.

After acknowledgement, maintainers will:

1. validate and triage the report;
2. determine affected components and severity;
3. coordinate remediation and verification privately where appropriate;
4. publish a security advisory when public disclosure is useful and safe.

High-impact vulnerabilities are prioritized over the normal development
backlog.

## Responsible disclosure

When researching ProSlides security:

- test only against systems and data you are authorized to use;
- avoid destructive testing, denial of service, spam, or unnecessary data
  access;
- stop testing and report immediately if you encounter sensitive user data,
  credentials, or secrets;
- give maintainers a reasonable opportunity to investigate and remediate before
  public disclosure.

Good-faith reports that follow these guidelines are welcome.
