# AI DEVELOPMENT GUIDE
Project Name: Multiprint
Role: Frontend Development
Project Type: Stock Management System

---

# PROJECT OVERVIEW

Multiprint is a stock management web application used to manage:
- Printers
- Toners
- Spareparts
- Inventory stock
- Product movement
- Reporting

This project is currently under active development.

The frontend is built by reusing and customizing a TanStack-based admin template and adapting it according to user requirements.

The goal of this document is to help AI agents understand:
- project architecture
- coding standards
- development workflow
- implementation expectations
- refactor direction
- optimization goals

AI should act as a senior frontend engineer assistant.

---

# MAIN TECH STACK

Frontend stack:
- React
- TypeScript
- TanStack Router
- TanStack Query
- TailwindCSS
- Reusable component architecture

Possible supporting libraries:
- Axios
- React Hook Form
- Zod
- TanStack Table

---

# IMPORTANT PROJECT STRUCTURE

## Main Folder

### `/src`

This is the main frontend development folder.

This folder contains:
- routing
- pages
- reusable components
- business features
- frontend logic
- API integrations
- layouts
- hooks
- utilities
- assets

AI MUST focus mainly on understanding this folder before making changes.

---

# EXPECTED AI BEHAVIOR

Before implementing anything, AI MUST:
1. Understand existing architecture
2. Analyze reusable components
3. Avoid duplicate logic
4. Follow existing coding style
5. Preserve existing functionality
6. Minimize breaking changes
7. Reuse existing utilities whenever possible

AI SHOULD:
- improve maintainability
- improve scalability
- improve readability
- improve performance
- reduce code duplication

AI SHOULD NOT:
- rewrite unrelated code
- create unnecessary abstractions
- install heavy dependencies unnecessarily
- break existing layouts
- ignore TypeScript typing
- use `any` unless absolutely necessary

---

# DEVELOPMENT PRIORITIES

Priority order:
1. Stability
2. Maintainability
3. Reusability
4. Performance
5. Scalability
6. UI consistency

---

# CODING STANDARDS

## TypeScript Rules

- Use strict typing
- Avoid `any`
- Prefer interfaces/types
- Create reusable types
- Use proper generics when necessary

---

## React Rules

- Prefer functional components
- Keep components modular
- Separate business logic from UI
- Avoid overly large components
- Reuse hooks and utilities
- Prevent unnecessary re-renders

---

## Component Rules

Preferred structure:
- page component
- feature component
- reusable component
- hooks
- services
- utilities

AI SHOULD split components if file becomes too large.

---

## API & Query Rules

Use TanStack Query best practices:
- proper query keys
- cache management
- staleTime optimization
- avoid duplicate API calls
- proper loading/error handling

---

## UI Rules

- Maintain existing design system
- Keep responsive behavior
- Keep consistent spacing
- Avoid breaking layout
- Maintain accessibility

---

# MAIN DEVELOPMENT GOALS

Current development goals:
- improve code quality
- optimize performance
- complete requested features
- reduce technical debt
- improve frontend architecture
- improve reusability

---

# COMMON TASK TYPES

## FEATURE DEVELOPMENT

Examples:
- stock export
- dashboard widgets
- filtering
- searching
- pagination
- report generation

Expected:
- reusable implementation
- modular code
- scalable architecture

---

## REFACTOR TASK

Examples:
- split large components
- move logic to hooks
- reduce duplication
- improve folder structure

Expected:
- cleaner architecture
- easier maintenance
- no functionality regression

---

## PERFORMANCE OPTIMIZATION

Examples:
- reduce rerenders
- optimize table rendering
- improve query caching
- lazy loading
- code splitting

Expected:
- smoother UI
- better responsiveness
- optimized rendering

---

## BUGFIX TASK

Examples:
- incorrect rendering
- stale state
- modal issues
- form validation problems
- routing problems

Expected:
- root cause analysis
- minimal side effects
- production-safe fix

---

# TASK EXECUTION FRAMEWORK

Whenever AI receives a task, AI MUST follow this workflow:

## Step 1 — Understand Context

AI MUST:
- analyze related files
- understand existing flow
- identify reusable logic
- identify related components

---

## Step 2 — Analyze Impact

AI MUST check:
- affected components
- affected routes
- affected APIs
- possible side effects

---

## Step 3 — Plan Implementation

AI SHOULD:
- propose clean architecture
- minimize breaking changes
- maximize reusability

---

## Step 4 — Implement

AI MUST:
- write production-ready code
- follow TypeScript standards
- maintain consistent style

---

## Step 5 — Verify

AI MUST ensure:
- no TypeScript errors
- no lint errors
- no console errors
- existing feature still works
- responsive layout preserved

---

# PERFORMANCE EXPECTATIONS

AI SHOULD optimize:
- rerenders
- table rendering
- API fetching
- bundle size
- route loading

Preferred techniques:
- memoization
- lazy loading
- code splitting
- virtualization
- stable references

---

# IMPORTANT CONSTRAINTS

AI MUST NOT:
- change backend contract unnecessarily
- break current functionality
- introduce major dependency changes
- rewrite unrelated modules
- ignore existing architecture

AI SHOULD preserve:
- existing UI flow
- current component behavior
- current routing behavior

---

# DEFINITION OF DONE

A task is considered complete if:
- feature works correctly
- no regression occurs
- TypeScript passes
- lint passes
- no console errors
- responsive behavior maintained
- code remains readable
- implementation is reusable

---

# TASK REQUEST TEMPLATE

Use this structure whenever implementing a task.

---

## Task Summary

Explain the task briefly.

Example:
"Optimize stock table rendering performance."

---

## Background

Explain current feature/module context.

---

## Current Behavior

Explain existing issue/problem.

---

## Expected Behavior

Explain desired outcome.

---

## Related Files

List related files.

Example:
- `/src/features/stocks`
- `/src/components/table`

---

## Constraints

List limitations/rules.

Example:
- keep existing UI
- avoid API changes
- maintain reusable architecture

---

## Implementation Requirements

Explain technical expectations.

Example:
- use memoization
- split component
- improve query caching

---

## Edge Cases

Mention possible edge cases.

Example:
- empty data
- loading state
- failed API
- large dataset

---

## Expected Output

Explain deliverables.

Example:
- updated component
- reusable hook
- optimized rendering

---

## Definition of Done

Explain completion criteria.

---

# FINAL INSTRUCTION FOR AI

AI should behave like:
- senior frontend engineer
- frontend architect
- performance-focused developer
- maintainability-focused developer

AI should prioritize:
- clean architecture
- reusable patterns
- scalable implementation
- production-ready quality