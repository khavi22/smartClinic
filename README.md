# 🏥 SmartClinic

SmartClinic is a modern, full-stack clinic management and appointment booking platform. Designed for visual excellence and seamless user experience, it allows patients to find clinics, check real-time availability, and manage their health appointments with ease.

---

## 🌟 Key Features

-   **Dynamic Availability**: Real-time integration with Firebase Firestore to manage and display clinic time slots.
-   **Seamless Booking**: Intuitive appointment scheduling with instant validation to prevent double-bookings.
-   **Premium Dashboard**: A sleek, user-centric dashboard for patients to view, track, and manage upcoming visits.
-   **Smart Rescheduling**: One-click rescheduling flow that preserves appointment context and minimizes user effort.
-   **Modern UI/UX**: Built with a "premium" healthcare aesthetic, featuring glassmorphism, responsive calendars, and semantic HTML structure.
-   **Secure Authentication**: Integrated Firebase Authentication for reliable and secure user access.

---

## 🚀 Tech Stack

-   **Frontend**: Native JavaScript (ES6+), Semantic HTML5, CSS3 (Modern Flex/Grid layouts).
-   **Backend**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/).
-   **Database**: [Firebase Firestore](https://firebase.google.com/docs/firestore) for scalable real-time data storage.
-   **Administration**: [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup) for secure server-side operations.
-   **Mock Data/Testing**: SQLite integration for local development and rapid prototyping.

---

## 📂 Project Structure

```text
smartClinic/
├── Controllers/      # Backend logic for Clinics, Users, and Appointments
├── models/           # Data models and structures
├── public/           # Frontend assets (HTML, CSS, JS, Images)
├── routes/           # Express API route definitions
├── services/         # Core services (Firebase integration, etc.)
├── server.js         # Main Express server entry point
└── functions/        # Firebase Cloud Functions (if applicable)
```

---

## 🛠️ Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/) (v14 or higher recommended)
-   npm (comes with Node.js)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/khavi22/smartClinic.git
    cd smartClinic
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure Environment Variables:
    Create a `.env` file in the root directory and add necessary configurations (e.g., `PORT`, `GOOGLE_CLIENT_ID`).

    > [!IMPORTANT]
    > **Security Note**: Currently, Firebase credentials are hardcoded in `services/firebaseService.js` for development. In a production environment, these **must** be moved to environment variables or a secure Secret Manager.

### Running the App

Start the development server:
```bash
npm start
```
The application will be available at `http://localhost:3000`.

---

## 📈 Recent Updates (Sprint 2)

-   **Availability Overhaul**: Transitioned from static time slots to a fully dynamic, Firebase-backed availability engine.
-   **Semantic CSS**: Refactored styling to use modern CSS practices and semantic HTML elements (like `<details>` and `<summary>`), reducing JavaScript overhead.
-   **Calendar Logic**: Implemented a custom state-aware calendar for intuitive date selection and month navigation.

---

## 📄 License

This project is licensed under the ISC License.

---
*Developed with ❤️ by the SmartClinic Team.*
