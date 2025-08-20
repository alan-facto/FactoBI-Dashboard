// Import only the necessary Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, getRedirectResult, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// IMPORTANT: This configuration must be identical to the one in your main.js
const firebaseConfig = {
  apiKey: "AIzaSyDuXzhFCIUICOV4xrf7uYl3hYPAQp6qhbs",
  authDomain: "financialdashboard-a60a6.firebaseapp.com",
  projectId: "financialdashboard-a60a6",
  storageBucket: "financialdashboard-a60a6.appspot.com",
  messagingSenderId: "876071686917",
  appId: "1:876071686917:web:4c1fc89d1fc21fdec49d6c",
  measurementId: "G-C8GQJJR945"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * This function runs automatically to process the redirect from Google.
 */
async function handleRedirect() {
    try {
        // Set persistence to 'local' to ensure the user stays logged in across sessions
        await setPersistence(auth, browserLocalPersistence);
        const result = await getRedirectResult(auth);
        
        if (result) {
            // The user has successfully signed in.
            // The onAuthStateChanged listener in your main.js file will now
            // receive the user's information and proceed with authorization.
            console.log("Redirect successful. User:", result.user.email);
        }
    } catch (error) {
        // If an error occurs (e.g., user closes the popup),
        // we store it in sessionStorage to display it on the main login page.
        console.error("Error during authentication redirect:", error.code, error.message);
        sessionStorage.setItem('authError', JSON.stringify({
            code: error.code,
            message: error.message
        }));
    } finally {
        // IMPORTANT: Always redirect back to the main application page,
        // whether the login was successful or not.
        window.location.replace('/');
    }
}

// Run the function
handleRedirect();
