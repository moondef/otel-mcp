# Contributing to otel-mcp

Thanks for your interest in contributing! This document covers the basics.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/moondef/otel-mcp.git
cd otel-mcp

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint and format
pnpm check
```

## Project Structure

```
src/
├── index.ts              # Entry point, CLI, mode detection
├── mcp/
│   ├── server.ts         # MCP server setup
│   └── tools/            # Tool implementations
├── receiver/
│   ├── server.ts         # HTTP server (Hono)
│   └── otlp.ts           # OTLP parsing
├── store/
│   ├── trace-store.ts    # In-memory storage
│   ├── types.ts          # Span/Trace types
│   └── filter-parser.ts  # WHERE expression parser
├── format/               # Output formatters
└── test/                 # Tests
```

## Making Changes

1. **Fork and branch** - Create a feature branch from `main`
2. **Make changes** - Keep them focused and minimal
3. **Test** - Run `pnpm test` and `pnpm typecheck`
4. **Commit** - Use clear commit messages
5. **PR** - Open a pull request with a description of changes

## Code Style

- Run `pnpm check` before committing (Biome handles formatting and linting)
- TypeScript strict mode is enabled
- Keep functions small and focused
- Add tests for new functionality

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

Tests are in `src/test/`. Add tests for:
- New MCP tools
- Store functionality changes
- OTLP parsing changes
- Format output changes

## Pull Request Guidelines

- Keep PRs focused on a single change
- Include tests for new features
- Update README if adding user-facing features
- Ensure CI passes

## Questions?

Open an issue for questions or discussion.
