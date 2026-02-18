# 🚀 A/B Testing Platform Instructions

Your application is running locally!

## 1. Access the Dashboard
Open your browser and go to:
**http://localhost:8080/dashboard.html**

## 2. Create a Test
1. Click **"+ New Experiment"**.
2. Name: "Homepage Test"
3. Target URL: `http://localhost:8080/index.html`
4. Variant B URL: `http://localhost:8080/variant-b.html`
5. Click **Launch**.

## 3. Verify the Test
1. Open a new tab (or Incognito window) to:
   **http://localhost:8080/index.html**
2. You will either stay on the white page (Control) or get redirected to the dark page (Variant B).
3. Click the **"Sign Up (Goal)"** button.
4. Go back to the **Dashboard** and click **"Stats"** to see your conversion recorded!

## Troubleshooting
- If the dashboard doesn't load, ensure the servers are running.
- Backend: `node index.js` in `server/` folder (Port 3000)
- Frontend: `npx http-server` in `client/` folder (Port 8080)
