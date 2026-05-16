# Deployment Instructions for ML Queue Detector

This document outlines how to deploy your two separate services for production.

## 1. Deploying the Node.js Backend

Your Node.js app remains largely the same. However, it now needs to know where the Python ML service lives.

1. Deploy your Node.js code to your preferred hosting provider (e.g., Firebase, Heroku, Render).
2. Go to your hosting provider's dashboard and locate the **Environment Variables** (or Secrets) section.
3. Add a new variable:
   - **Key**: `ML_SERVICE_URL`
   - **Value**: `https://<your-deployed-python-url>` (You will get this URL in Step 2).
4. Restart/Redeploy your Node.js app.

## 2. Deploying the Python ML Service (`ml_service` / `queue_detector`)

The easiest free way to deploy the Python backend is using **Render.com**.

### Setup on Render (If you don't own the GitHub Repo)
Since you do not own the GitHub repository, you cannot directly connect it to Render. Here are two easy workarounds:

**Option A: Fork the Repository (Easiest)**
1. Go to the repository on GitHub and click the **Fork** button in the top right corner to create a copy of the project under your own personal GitHub account.
2. Go to [Render.com](https://render.com) and sign in.
3. Click **New +** and select **Web Service**.
4. Connect your GitHub account and select your **forked** repository.
5. Configure the following:
   - **Root Directory**: `queue_detector` (or `ml_service` if you didn't rename it).
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app` 
   - **Instance Type**: Select the Free tier.

**Option B: Deploy directly from your terminal using Railway**
If you don't want to use GitHub at all, you can use [Railway.app](https://railway.app):
1. Install the Railway CLI on your computer.
2. Open your terminal, navigate to the `queue_detector` folder, and type `railway login`.
3. Type `railway init` to create a project.
4. Type `railway up` to push your code directly from your local machine to the internet without going through GitHub.
5. Use the Railway dashboard to set the `FIREBASE_CREDENTIALS_JSON` environment variable (as explained below).

### Setting up the Environment Variable
You cannot commit `serviceAccountKey.json` to GitHub for security reasons. Instead:

1. Open your `serviceAccountKey.json` file locally and copy all of the text inside it.
2. Go to the **Environment** tab of your Web Service in the Render dashboard.
3. Click **Add Environment Variable**.
4. Set the Key to `FIREBASE_CREDENTIALS_JSON`.
5. Paste the entire JSON text into the Value field.
6. Save and trigger a manual deploy.

### Final Step
Once Render finishes deploying your Python app, it will give you a live URL (e.g., `https://smartclinic-ml.onrender.com`).
Copy this URL and paste it into the `ML_SERVICE_URL` environment variable of your Node.js app (from Step 1).

Your production setup is complete!
