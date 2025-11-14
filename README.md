# AquaTrack - Cloud Deployment Steps

This guide outlines the three main phases for deploying the AquaTrack application to AWS.

Follow these steps in order. Once you've completed a step, you can ask for detailed instructions on the next one.

---

### Phase 1: Set Up Your Database (Completed)

**Goal:** Create a live, cloud-based database to store your application's data.

-   [x] **Step 1:** Create a PostgreSQL database using Amazon RDS.
-   [x] **Step 2:** Connect to the database and create the `fields` and `water_orders` tables.

---

### Phase 2: Deploy Your Backend API (In Progress)

**Goal:** Deploy the backend logic that connects to your database and serves data to your app.

-   [ ] **Step 3:** Securely store your database credentials in AWS Secrets Manager.
-   [ ] **Step 4:** Create and configure a Lambda function to run the backend code.
-   [ ] **Step 5:** Create an API Gateway endpoint to make your Lambda function accessible from the internet.

---

### Phase 3: Deploy Your Frontend Application

**Goal:** Put your user interface on the web so users can access it.

-   [ ] **Step 6:** Connect your code repository to AWS Amplify Hosting.
-   [ ] **Step 7:** Configure Amplify with your API endpoint URL and Gemini API key.
-   [ ] **Step 8:** Deploy the application to get your public URL.

---

Let me know when you're ready to begin with the next step.
