---
description: Run the full local CI/CD pipeline for ZhengMing.
---

This workflow automates the build, test, and containerization process for the project.

// turbo-all
1. Run the CI script to verify the project:
   ```bash
   bash scripts/ci.sh
   ```

2. If the CI script passes, the local Docker image `zhengming:local` is ready for deployment or local testing.
