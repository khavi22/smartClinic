# Integrating Codecov with SmartClinic CI Pipeline

This guide outlines the step-by-step process to set up **Codecov** (codecov.io) on your GitHub repository. Doing this allows you to automatically upload test coverage reports, view coverage graphs, get detailed PR status checks, and display a live coverage badge on your `README.md`.

---

## 📋 Prerequisites

* Your Jest test suite generates coverage files (already set up in your `package.json` via `"test:coverage": "jest --coverage"`).
* Admin access to your GitHub repository: `https://github.com/khavi22/smartClinic`.

---

## 🛠️ Step-by-Step Setup

### Step 1: Link Your Repository on Codecov
1. Go to [codecov.io](https://codecov.io/) and click **Sign Up** / **Login**. Select **GitHub** to authenticate.
2. Once logged in, navigate to your organization/user dashboard.
3. Locate or search for your repository: **`smartClinic`**.
4. Click **Setup Repo** (or **Configure**).
5. Codecov will generate a unique **Upload Token** (e.g., a string like `d4c98f8e-1234-abcd-ef00-123456789abc`). **Copy this token to your clipboard.**

> [!NOTE]
> For public repositories, the token is technically optional but **highly recommended** to avoid GitHub API rate limits or upload failures during heavy CI runs. For private repositories, the token is **mandatory**.

---

### Step 2: Save the Upload Token in GitHub Secrets
To protect your token and prevent it from being exposed in public code, save it as an encrypted GitHub Secret:

1. Open your repository on GitHub: `https://github.com/khavi22/smartClinic`.
2. Click the **Settings** tab at the top.
3. In the left-hand sidebar, scroll down to the **Security** section and click **Secrets and variables** → **Actions**.
4. Click the green **New repository secret** button.
5. Fill in the form:
   * **Name**: `CODECOV_TOKEN`
   * **Value**: *(Paste your Codecov upload token here)*
6. Click **Add secret**.

---

### Step 3: Update Your GitHub Actions Workflow
Now, update your workflow to upload your Jest coverage reports directly to Codecov on every push or pull request. 

Replace the contents of your `.github/workflows/test.yml` with the following configuration:

```yaml
name: Run Tests and Coverage

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm install

      - name: Run tests with coverage
        run: npm run test:coverage

      - name: Upload coverage reports to Codecov
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: true
          verbose: true
```

> [!IMPORTANT]
> Jest outputs coverage reports inside a `./coverage/lcov.info` file by default when running `jest --coverage`. Codecov automatically detects this path, parses the report, and matches it with your repository's source code.

---

### Step 4: Add a Live Coverage Badge to your README
To show off your exact code coverage percentage (e.g., `80%`) directly on your repository homepage:

1. In Codecov, go to your repository dashboard and click **Settings** (or **Badge**).
2. Copy the markdown snippet provided, or use this format:
   ```markdown
   [![codecov](https://codecov.io/gh/khavi22/smartClinic/graph/badge.svg?token=YOUR_BADGE_TOKEN)](https://codecov.io/gh/khavi22/smartClinic)
   ```
3. Open your `README.md` file in the root of your project and paste the badge snippet at the very top under your repository title.

---

## 🔍 How to Verify
1. Commit and push these workflow changes to GitHub:
   ```bash
   git add .github/workflows/test.yml
   git commit -m "ci: integrate codecov coverage uploads"
   git push origin main
   ```
2. Navigate to your GitHub repository and click the **Actions** tab.
3. Click on the active workflow run to watch the logs.
4. Once completed, you will see a successful step for `Upload coverage reports to Codecov`.
5. Go to your Pull Request page or check your [Codecov dashboard](https://codecov.io/) to see a beautiful coverage breakdown!
