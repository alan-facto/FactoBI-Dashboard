// Import necessary functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// This configuration must be identical to the one in your main.js
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

const loginBtn = document.getElementById('login-btn');
const loginStatus = document.getElementById('login-status');
const authError = document.getElementById('auth-error');

// --- Authentication Logic ---

// First, check if the user is already signed in. If so, redirect to the dashboard.
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = '/index.html'; // or just '/'
    }
    // If no user, do nothing and wait for the button click.
});


async function handleSignIn() {
    const provider = new GoogleAuthProvider();
    try {
        loginStatus.textContent = 'Aguarde...';
        authError.style.display = 'none';
        
        // Ensure user session is saved locally
        await setPersistence(auth, browserLocalPersistence);
        await signInWithPopup(auth, provider);
        
        // onAuthStateChanged will detect the new user and redirect.
        
    } catch (error) {
        console.error("Error during sign-in:", error);
        authError.textContent = `Erro no login: ${error.message}`;
        authError.style.display = 'block';
        loginStatus.textContent = 'Faça login para continuar';
    }
}

loginBtn.addEventListener('click', handleSignIn);
