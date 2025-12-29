# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2025-12-29

### Fixed
- Removed hardcoded ports from log messages

## [0.1.3] - 2025-12-29

### Added
- Example `.mcp.json` configuration file

## [0.1.2] - 2025-12-29

### Changed
- Metadata updates for npm package

## [0.1.1] - 2025-12-29

### Added
- GitHub Actions CI pipeline
- Documentation links to articles

## [0.1.0] - 2025-12-29

### Added
- Initial release
- OTLP HTTP receiver on port 4318
- In-memory trace storage with LRU eviction
- MCP server with stdio transport
- Tools: `list_traces`, `get_trace`, `query_spans`, `get_summary`, `clear_traces`
- Multi-session support (primary/client mode)
- `where` expression filtering for spans
- Configurable limits via environment variables
- Node.js example application
