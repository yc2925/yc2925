import { ref, uploadString } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { signInWithPopup, signOut } from "firebase/auth";
import { auth, provider, db, storage } from "./firebase.js";
import { useState } from "react";

import ParticlesView from "./views/ParticlesView.jsx";
import Noise2DView from "./views/Noise2DView.jsx";
import Noise3DView from "./views/Noise3DView.jsx";
import SimulationView from "./views/SimulationView.jsx";
import VoxelLabView from "./views/VoxelLabView.jsx";

import AppTabs from "./ui/AppTabs.jsx";
import ParticlesPanel from "./ui/ParticlesPanel.jsx";
import NoisePanel from "./ui/NoisePanel.jsx";

import { DEFAULT_PARTICLES } from "./particleSettings.js";
import { DEFAULT_NOISE } from "./noise/settings.js";

import "./App.css";

function App() {
  const [tab, setTab] = useState("particles");
  const [particles, setParticles] = useState(DEFAULT_PARTICLES);
  const [noise, setNoise] = useState(DEFAULT_NOISE);

  const isNoiseTab = tab === "noise2d" || tab === "noise3d";

  async function saveConfig() {
    const user = auth.currentUser;
  
    if (!user) {
      alert("Login first");
      return;
    }
  
    try {
      const config = {
        tab,
        particles,
        noise
      };
  
      const configJson = JSON.stringify(config);
  
      await setDoc(
        doc(db, "users", user.uid, "configs", "latest"),
        {
          configJson: configJson
        }
      );

      console.log("Firestore saved");

      const fileRef = ref(
        storage,
        `users/${user.uid}/latest-config.json`
      );
      
      await uploadString(
        fileRef,
        configJson,
        "raw",
        {
          contentType: "application/json"
        }
      );

      console.log("Storage upload successful");
  
      alert("Configuration saved!");
      console.log("Saved configuration:", config);
    } catch (error) {
      console.error("Save error:", error);
      alert("Save failed. Check the browser console.");
    }
  }
  async function loadConfig() {
    const user = auth.currentUser;
  
    if (!user) {
      alert("Login first");
      return;
    }
  
    try {
      const snapshot = await getDoc(
        doc(db, "users", user.uid, "configs", "latest")
      );
  
      if (!snapshot.exists()) {
        alert("No saved configuration found.");
        return;
      }
  
      const savedData = snapshot.data();
      const config = JSON.parse(savedData.configJson);
  
      if (config.tab) {
        setTab(config.tab);
      }
  
      if (config.particles) {
        setParticles(config.particles);
      }
  
      if (config.noise) {
        setNoise(config.noise);
      }
  
      alert("Configuration loaded!");
      console.log("Loaded configuration:", config);
    } catch (error) {
      console.error("Load error:", error);
      alert("Load failed. Check the browser console.");
    }
  }

  async function login() {
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("Logged in:", result.user.email);
      alert(`Logged in as ${result.user.email}`);
    } catch (error) {
      console.error("Login error:", error);
    }
  }

  async function logout() {
    try {
      await signOut(auth);
      console.log("Logged out");
      alert("Logged out");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  return (
    <div className="app">

      <div className="firebase-actions" aria-label="Firebase configuration controls">
        <button type="button" onClick={login}>
          LOGIN WITH GOOGLE
        </button>

        <button type="button" onClick={logout}>
          LOGOUT
        </button>

        <button type="button" onClick={saveConfig}>
          SAVE CONFIGURATION
        </button>

        <button type="button" onClick={loadConfig}>
          LOAD CONFIGURATION
        </button>
      </div>

      {tab === "particles" ? (
        <ParticlesView particles={particles} />
      ) : null}

      {tab === "noise2d" ? (
        <Noise2DView noise={noise} />
      ) : null}

      {tab === "noise3d" ? (
        <Noise3DView noise={noise} />
      ) : null}

      {tab === "simulation" ? (
        <SimulationView
          noise={noise}
          onNoiseChange={setNoise}
        />
      ) : null}

      {tab === "voxelLab" ? <VoxelLabView /> : null}

      <header className="app-header">
        <p className="app-kicker">yc2925</p>
        <h1>Procedural World Building</h1>

        <AppTabs
          tab={tab}
          onTabChange={setTab}
        />
      </header>

      {isNoiseTab ? (
        <NoisePanel
          noise={noise}
          onNoiseChange={setNoise}
        />
      ) : tab === "particles" ? (
        <ParticlesPanel
          particles={particles}
          onParticlesChange={setParticles}
        />
      ) : null}

    </div>
  );
}

export default App;