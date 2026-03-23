import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBwoX-LRqgAmX0dxwoR3rEmxOiFVftX66w",
  authDomain: "spotify-clone-1a989.firebaseapp.com",
  projectId: "spotify-clone-1a989",
  storageBucket: "spotify-clone-1a989.firebasestorage.app",
  messagingSenderId: "553658747374",
  appId: "1:553658747374:web:10beccbe20d537d03ca6ff"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function showApp(){
  document.getElementById("loginScreen").style.display="none";
  document.getElementById("mainApp").style.display="block";
}

function showLogin(){
  document.getElementById("loginScreen").style.display="flex";
  document.getElementById("mainApp").style.display="none";
}

window.addEventListener("load", ()=>{
  const token = localStorage.getItem("token");
  if(token) showApp();
  else showLogin();
});

window.googleLogin = async ()=>{
  const result = await signInWithPopup(auth, provider);
  const token = await result.user.getIdToken();
  localStorage.setItem("token","Bearer "+token);
  showApp();
  location.reload();
};

window.signup = async ()=>{
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  const user = await createUserWithEmailAndPassword(auth,email,pass);
  const token = await user.user.getIdToken();

  localStorage.setItem("token","Bearer "+token);
  showApp();
  location.reload();
};

window.emailLogin = async ()=>{
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;

  const user = await signInWithEmailAndPassword(auth,email,pass);
  const token = await user.user.getIdToken();

  localStorage.setItem("token","Bearer "+token);
  showApp();
  location.reload();
};

window.logout = ()=>{
  localStorage.removeItem("token");
  showLogin();
};


