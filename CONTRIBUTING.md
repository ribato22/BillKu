# Contributing to BillKu

Thank you for your interest in contributing to BillKu! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Bugs](#reporting-bugs)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** for your changes
4. **Commit** your changes with clear messages
5. **Push** to your fork
6. **Open a Pull Request** against the `main` branch

## Development Setup

### Prerequisites

- Node.js >= 20.x
- npm >= 10.x
- Docker (optional, for containerized development)

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/BillKu.git
cd BillKu

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Configure environment
cp .env.example .env

# Initialize database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start backend (port 4000)
npm run start:dev

# In a new terminal — start frontend (port 4001)
cd frontend && npm run dev
```

### Docker Setup

```bash
cp .env.example .env
docker compose up -d
```

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the [coding standards](#coding-standards)

3. Write clear, descriptive commit messages:
   ```
   feat: add invoice PDF export
   fix: resolve currency rounding error
   docs: update API specification
   refactor: simplify payment processing logic
   ```

4. Push to your fork and open a Pull Request

5. Ensure your PR description includes:
   - **What** the change does
   - **Why** the change is needed
   - **How** to test the change
   - Screenshots (for UI changes)

## Coding Standards

### Backend (NestJS)

- Use TypeScript strict mode
- Follow NestJS conventions (modules, controllers, services)
- Use Prisma for all database operations
- Add JSDoc comments for public methods
- Use DTOs with `class-validator` decorators for input validation

### Frontend (Next.js)

- Use React Server Components where possible
- Follow Next.js App Router conventions
- Use TypeScript for all components
- Implement responsive designs

### General

- Use `camelCase` for variables and functions
- Use `PascalCase` for classes, interfaces, and types
- Use `UPPER_SNAKE_CASE` for constants
- Keep functions small and focused (single responsibility)
- Write meaningful variable names

## Reporting Bugs

Use [GitHub Issues](https://github.com/ribato22/BillKu/issues) to report bugs. Include:

- **Description**: What happened?
- **Steps to reproduce**: How can we reproduce the issue?
- **Expected behavior**: What should have happened?
- **Environment**: OS, Node.js version, browser
- **Screenshots**: If applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
