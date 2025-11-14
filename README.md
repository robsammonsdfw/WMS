# AquaTrack - Cloud Deployment Steps

This guide outlines the three main phases for deploying the AquaTrack application to AWS.

Follow these steps in order. Once you've completed a step, you can ask for detailed instructions on the next one.

---

### Phase 1: Set Up Your Database (Completed)

**Goal:** Create a live, cloud-based database to store your application's data.

-   [x] **Step 1:** Create a PostgreSQL database using Amazon RDS.
-   [x] **Step 2:** Connect to the database and create the `fields` and `water_orders` tables.

---

### Phase 2: Deploy Your Backend API (Completed)

**Goal:** Deploy the backend logic that connects to your database and serves data to your app.

-   [x] **Step 3:** Create, configure, and deploy the Lambda function.
-   [x] **Step 4:** Create an API Gateway endpoint to make your Lambda function accessible from the internet.

---

### Phase 3: Deploy Your Frontend Application (In Progress)

**Goal:** Put your user interface on the web so users can access it.

-   [x] **Step 5:** Connect your code repository to AWS Amplify Hosting.
-   [ ] **Step 6:** Configure Amplify with your API endpoint URL and Gemini API key. (Current Step)
-   [ ] **Step 7:** Deploy the application to get your public URL.

---

Let me know when you're ready to begin with the next step.