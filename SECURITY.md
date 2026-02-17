# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.x     | ✅ Active support  |

## Reporting a Vulnerability

We take the security of BillKu seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send an email to:

📧 **rizkybachtiar7@gmail.com**

Include the following information:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

| Timeline | Action |
|----------|--------|
| **24 hours** | Acknowledgment of your report |
| **72 hours** | Initial assessment and severity rating |
| **7 days** | Plan for fix or mitigation |
| **30 days** | Security patch released |

### Scope

The following are in scope for security reports:

- Authentication and authorization bypasses
- SQL injection or database exposure
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Remote code execution
- Sensitive data exposure
- Server-side request forgery (SSRF)

### Out of Scope

- Denial of service (DoS) attacks
- Social engineering
- Issues in third-party dependencies (report upstream)
- Issues requiring physical access

## Security Best Practices

When deploying BillKu in production:

1. **Change default secrets** — Generate a strong `JWT_SECRET`
2. **Use HTTPS** — Always deploy behind a TLS-terminating reverse proxy
3. **Restrict network access** — Use firewall rules (UFW) to limit exposed ports
4. **Keep updated** — Regularly pull the latest version for security patches
5. **Backup data** — Implement regular database backups
6. **Monitor logs** — Enable and review audit logs

## Acknowledgments

We appreciate the security research community and will acknowledge reporters (with permission) in our release notes.
