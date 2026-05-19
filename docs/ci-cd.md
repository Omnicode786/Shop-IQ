# ShopIQ CI/CD Architecture

## Workflow structure

The repository uses three GitHub Actions workflows:

- `ci.yml` validates every pull request and protected branch push.
- `preview-deploy.yml` creates Vercel Preview deployments for pull requests from this repository.
- `production-deploy.yml` deploys the `main` branch to Vercel Production after a verified build.

The project uses npm, Next.js, TypeScript, ESLint, Prisma, and Vercel's prebuilt deployment flow. Dependency caching is handled by `actions/setup-node` using `package-lock.json`.

## Branching flow

- Feature work happens on short-lived branches.
- Pull requests target `develop` or `main`.
- `develop` is optional for integration testing when the team wants a staging-style branch.
- `main` is the production branch and should be protected.

Recommended branch protection for `main`:

- Require pull request review.
- Require the `CI / Validate application` status check.
- Require branches to be up to date before merge.
- Restrict direct pushes.
- Require deployment approval for the GitHub `Production` environment.

## Deployment lifecycle

1. A developer opens or updates a pull request.
2. CI installs dependencies, generates Prisma client code, type-checks, lints, checks CI/CD-owned formatting, runs tests, audits dependencies, and verifies the Next.js build.
3. The preview workflow pulls Vercel Preview environment variables, builds with `vercel build`, deploys the prebuilt artifact, and comments the preview URL on the pull request.
4. After review and merge to `main`, the production workflow pulls Vercel Production environment variables, builds with `vercel build --prod`, and deploys with `vercel deploy --prebuilt --prod`.

## Preview deployment flow

Preview deployments run on pull requests from the same repository. Forked pull requests are intentionally skipped because GitHub does not expose repository secrets to untrusted forks.

Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Required Vercel Preview environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Production deployment flow

Production deployments run on pushes to `main` and manual `workflow_dispatch` runs. The workflow is attached to the GitHub `Production` environment so teams can add manual approvals, deployment history, and environment-specific protections.

Required Vercel Production environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

`JWT_SECRET` must be at least 32 characters and must not contain placeholder text.

## Formatting baseline

The initial blocking Prettier check is scoped to CI/CD-owned files: `.github`, `docs`, `package.json`, `.prettierrc`, and `.prettierignore`. A whole-repository Prettier check currently reports legacy formatting drift across the application, so broadening the gate should be done in a dedicated formatting pull request to avoid mixing operational CI/CD work with unrelated source rewrites.

## Secrets management

GitHub Actions stores only Vercel control-plane credentials:

- `VERCEL_TOKEN` is a scoped Vercel token used by the CLI.
- `VERCEL_ORG_ID` identifies the Vercel team or account.
- `VERCEL_PROJECT_ID` identifies the linked Vercel project.

Application runtime secrets live in Vercel Environment Variables, separated by Preview and Production environments. Do not commit `.env` files or production credentials to the repository.

## Rollback mechanism

Vercel keeps immutable deployments. To roll back production:

1. Open the Vercel project dashboard.
2. Go to Deployments.
3. Select the last known-good production deployment.
4. Promote it to Production.

For command-line rollback, use the Vercel CLI to list deployments and promote a known-good deployment:

```bash
npx vercel ls
npx vercel promote <deployment-url-or-id> --token=$VERCEL_TOKEN
```

After rollback, create a follow-up pull request that fixes the root cause and let the normal CI/CD flow redeploy production.
