## [0.2.0] - 2026-04-06

> **@kb-labs/mind** 0.1.0 → 0.2.0 (minor: new features)

### ✨ New Features

- **contracts**: Extends types with a two-tier memory system and introduces the EmbeddingProvider abstraction, enhancing flexibility and efficiency in memory management.
- **compression**: Adds an OpenAI compressor and summarizer, allowing users to process and condense information more effectively.
- **mind-cli**: Introduces the mind-cli package with initial commands and configuration, making it easier for users to interact with the system via command line.
- **engine**: Adds a filtering stage for indexing, improving the relevance and quality of indexed content for users.
- **engine**: Enhances platform adapter and vector store, ensuring better integration and performance with various data sources.
- **mind**: Implements a platform vector-store adapter and IPC config propagation, streamlining data handling and communication within the platform.
- **mind**: Refreshes embeddings, gateway verification, and orchestrator, ensuring up-to-date functionality and improved performance.
- **mind-cli**: Surfaces adapter information and aligns it with SDK exports, providing users with clearer insights into available functionalities.
- **engine**: Improves markdown chunking and the platform vector store, enhancing the way content is processed and retrieved.
- **cli**: Updates RAG commands with configurable types, offering users more control over their command executions.
- **orchestrator**: Aligns with platform analytics and dependencies, ensuring smoother operation and integration with analytical tools.
- **engine**: Shifts to a platform-backed vector store and learning system, improving data accessibility and learning capabilities for users.
- **cli**: Refreshes RAG commands and setup flow, making the process more intuitive and user-friendly.
- **mind**: Adds CLI handlers and orchestrator utilities, streamlining command execution and enhancing user experience.
- **orchestrator**: Introduces advanced orchestration modules, enabling users to manage complex workflows more effectively.
- **engine**: Adds adaptive search and smart reranking capabilities, improving the accuracy and relevance of search results for users.
- **types**: Introduces support for JSON output and query modes, facilitating better data handling and integration with various applications.
- **embeddings**: Adds caching and updates providers, enhancing performance and reducing latency for users when accessing embeddings.
- **engine**: Introduces new processing modules for advanced RAG capabilities, allowing for more sophisticated data retrieval and analysis.
- **chunking**: Adds advanced chunking strategies and removes the legacy AST-based approach, improving content processing efficiency.
- **manifest

### 🐛 Bug Fixes

- **engine**: Resolves issues with indexing and search functionalities, ensuring users can find the information they need quickly and accurately.
- **cli**: Clarifies platform usage in rag commands, helping users avoid confusion and potential errors when using command line tools.
- **commands**: Introduces explicit flag and result types for the mind:verify command, making it easier for users to understand and utilize this functionality correctly.
- **docs**: Updates the Last Updated date to November 2025, providing users with the most current documentation reference.
- **docs**: Refreshes the ADR reference to ensure users have access to the latest architectural decisions and rationale.
- **docs**: Corrects a typo in the ADR filename, enhancing the clarity and professionalism of the documentation.
- **types**: Fixes the generic type usage in readJson, ensuring users receive accurate type information for better code quality.
- **types**: Adds a null check for the optional error.hint property, improving error handling and user experience by preventing unexpected crashes.
- **mind-indexer**: Now returns mindDir from initMindStructure, allowing users to easily access and manage their directory structure more effectively.
