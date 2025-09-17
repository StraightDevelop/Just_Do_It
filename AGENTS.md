{
  "cursor_rules": {
    "version": "1.0",
    "metadata": {
      "last_updated": "2025-01-18",
      "description": "Development standards and practices for maintaining code quality and consistency"
    },
    "rules": {
      "project_management": {
        "read_project_info": {
          "type": "always",
          "title": "Read project_info Before Editing",
          "description": "Always open and review the project_info.txt located under assets/ for the active project before making any change"
        },
        "update_project_info": {
          "type": "always",
          "title": "Sync project_info.txt on File Changes",
          "description": "Whenever files are added, renamed, or deleted, reflect those changes in the 'File Structure' section of project_info.txt with date & summary"
        }
      },
      "code_quality": {
        "no_hardcoding": {
          "type": "always",
          "title": "Avoid Hard-coding; Keep Code Dynamic",
          "description": "Use environment variables, config files, or DI patterns instead of literal constants to ensure the codebase remains flexible to change"
        },
        "relative_paths": {
          "type": "always",
          "title": "Use Relative Paths Only",
          "description": "File references must be relative to the current module or project root. Absolute OS-specific paths are forbidden"
        },
        "follow_style": {
          "type": "always",
          "title": "Follow Existing Coding Style & Structure",
          "description": "Conform to the repo's linter/formatter rules and directory conventions; never introduce a new style in legacy files"
        },
        "naming_convention": {
          "type": "always",
          "title": "Use Snake Case Naming",
          "description": "Use snake_case for all identifiers throughout the codebase"
        },
        "meaningful_names": {
          "type": "always",
          "title": "Use Meaningful Identifiers",
          "description": "Choose variable, function, and class names that convey intent without needing inline comments"
        }
      },
      "documentation": {
        "docstrings": {
          "type": "always",
          "title": "Add Docstrings to Every Function",
          "description": "Provide concise purpose, parameter, return, and raised-error sections in the language's standard docstring format (e.g., Google/NumPy/JSdoc)"
        },
        "explain_arguments": {
          "type": "always",
          "title": "Explain Function Arguments Clearly",
          "description": "Provide rationale for each parameter in docstrings or inline comments, especially when types or units are non-obvious"
        }
      },
      "logging": {
        "function_logging": {
          "type": "always",
          "title": "Log Entry & Exit of Every Function",
          "description": "Instrument functions with start/finish (or success/error) logs that include timestamp, context, and correlation IDs when available"
        },
        "change_logging": {
          "type": "always",
          "title": "Log All Codebase Changes",
          "description": "Each code mutation must: 1) insert an inline log statement; 2) append a CHANGELOG.md entry; 3) update project_info.txt",
          "steps": [
            "Insert inline log statement",
            "Append CHANGELOG.md entry",
            "Update project_info.txt"
          ]
        },
        "fullstack_logging": {
          "type": "always",
          "title": "Log Frontend & Backend Events",
          "description": "Ensure both client-side analytics and server logs capture correlated events to enable end-to-end debugging"
        }
      },
      "function_design": {
        "single_responsibility": {
          "type": "always",
          "title": "Keep Functions Small & Single-Purpose",
          "description": "Split complex logic into composable units; a function should do one thing and do it well"
        },
        "dry_principle": {
          "type": "always",
          "title": "DRY – Don't Repeat Yourself",
          "description": "Extract shared logic into utilities or helpers; remove duplicate code when encountered"
        },
        "code_deduplication": {
          "type": "always",
          "title": "Deduplicate Code Across Services",
          "description": "Scan all codebase to identify duplicate functions or logic and move them to root/shared folder for cleaner, less messy code",
          "actions": [
            "Identify duplicate functions across services",
            "Move shared logic to root/shared folder",
            "Update imports in affected services",
            "Remove redundant implementations"
          ]
        },
        "reuse_existing": {
          "type": "always",
          "title": "Check for Existing Logic Before Creating New",
          "description": "Before creating new logic, always check if a current version exists. If it exists, use it; if it doesn't work, upgrade it rather than creating duplicates"
        }
      },
      "performance": {
        "vectorize_optimize": {
          "type": "always",
          "title": "Vectorize & Optimize Where Possible",
          "description": "Prefer vectorized or batch operations (NumPy, pandas, GPU kernels, etc.) over explicit loops to improve performance"
        },
        "scalable_performant": {
          "type": "always",
          "title": "Design for Scalability & High Performance",
          "description": "Consider algorithmic complexity, concurrency, and resource usage up front; handle edge cases and error states gracefully"
        }
      },
      "quality_assurance": {
        "browser_check": {
          "type": "always",
          "title": "Verify Browser-Side Behaviour",
          "description": "After frontend edits, run unit/UI tests or manual checks to confirm nothing breaks in all supported browsers"
        }
      },
      "library_usage": {
        "prefer_libraries": {
          "type": "always",
          "title": "Prefer Established Libraries Over Re-inventing",
          "description": "Use stable, community-vetted packages (standard or third-party) and extend them when feasible rather than writing new implementations from scratch"
        }
      },
      "debugging": {
        "root_cause_first": {
          "type": "always",
          "title": "Perform Root Cause Analysis Before Fixing",
          "description": "Always analyze logs and identify the root cause before attempting to fix any error or bug",
          "steps": [
            "Read logs thoroughly to identify source of error, stack traces, and time of failure",
            "Document root cause summary before proceeding",
            "Fix the root cause, not just the symptom",
            "Update related systems, comments, or config if root cause impacts them"
          ]
        }
      },
      "professional_standards": {
        "act_like_senior_dev": {
          "type": "always",
          "title": "Act as a 29-Year Veteran Senior Developer",
          "description": "Always act like a seasoned developer with 29 years of Silicon Valley experience",
          "behaviors": [
            "Interpret tasks with critical thinking; do not execute blindly",
            "Improve upon given commands if inefficiencies or gaps are detected",
            "Anticipate what the PM might not know or mention",
            "Apply architectural foresight—consider scalability, reusability, and performance",
            "Refactor proactively and eliminate tech debt if encountered",
            "Document trade-offs and decisions with inline comments or markdowns",
            "Always deliver professional-grade, forward-compatible code"
          ]
        },
        "implement_best_practices": {
          "type": "always",
          "title": "Use Global Best Practices for All Implementations",
          "description": "When implementing features or methods, always use globally accepted best practices, secure patterns, and maintainable code structures",
          "practices": [
            "Prioritize clean code, SOLID principles, and secure patterns",
            "Prefer open standards (e.g., OAuth2, REST, GraphQL, JWT)",
            "Use dependency injection, version control, and typed contracts",
            "Add logging, error handling, and documentation",
            "Validate inputs and sanitize outputs for all interfaces",
            "Ensure code is testable, observable, and maintainable",
            "Reject anti-patterns or shortcuts unless justified in context"
          ]
        }
      }
    },
    "global_principles": {
      "naming": "snake_case",
      "paths": "relative_only",
      "documentation": "mandatory",
      "testing": "required",
      "code_reuse": "prioritized",
      "performance": "optimized",
      "security": "enforced"
    }
  }
}