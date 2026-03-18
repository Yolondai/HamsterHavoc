# Hamster Havoc: The Game

A high-speed, high-contrast arcade game where you control a hamster avoiding obstacles.

## How to Play

- **Click/Tap** to move the hamster.
- Avoid the obstacles to survive as long as possible.
- Collect power-ups (if any) to boost your score.

## Deployment to GitHub Pages

This project is configured for easy deployment to GitHub Pages.

### Method 1: GitHub Actions (Recommended)

This project is already configured with a GitHub Actions workflow at `.github/workflows/deploy.yml`.

1.  Push your code to a GitHub repository on the `main` branch.
2.  Go to your repository on GitHub.
3.  Go to **Settings > Pages**.
4.  Under **Build and deployment > Source**, select **GitHub Actions**.
5.  The deployment will start automatically on your next push to `main`.

### Method 2: Manual Build

1.  Run `npm install`.
2.  Run `npm run build`.
3.  The output will be in the `dist/` folder.
4.  You can push the contents of the `dist/` folder to a branch named `gh-pages`.

## Local Development

1.  Clone the repository.
2.  Install dependencies: `npm install`.
3.  Start the development server: `npm run dev`.
