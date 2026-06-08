## 🪔 Focus Timer & Study Lamp Extension

A gamified, fully synced focus environment that bridges the gap between your desktop and your browser. Focus Timer uses a beautifully designed desktop app to enforce a custom whitelist of applications and websites, while a companion Chrome Web Store extension actively keeps your web browsing in check.

*Pull up a chair. Turn on the light. Get things done.*

### ✨ Key Features

* **Dual-Environment Blocking:** Whitelist specific desktop applications and web domains. If it isn't on your list, it stays dark.
* **Live Browser Dashboard:** Click the extension icon at any time to see your live remaining time, current level, XP earned this session, and active whitelist without opening the desktop app.
* **Strict vs. Soft Mode:** Choose "Strict" mode to forcefully close unauthorized desktop apps, or "Soft" mode to gently minimize them when they steal focus.
* **Gamified Progression:** Earn XP for every minute of deep work, level up your rank (from Beginner to Legend), and build a daily focus streak.
* **Live Browser Sync:** The Chrome extension talks directly to the desktop app's local background server (`127.0.0.1:54321`) to actively block distracting URLs and redirect you to a custom focus page.
* **Emergency Bypass:** Need to check a two-factor authentication code? Use the built-in 2-minute emergency access button on blocked sites before the restriction automatically kicks back in.
* **Cozy Aesthetic:** Designed with a warm amber and dark wood theme to make studying feel like a late-night library session rather than a clinical productivity tool.

### 🚀 Installation & Setup

Using Focus Timer requires two parts: the desktop app to manage your session, and the browser extension to keep your web tabs in check.

**1. The Desktop App**

* Head over to the Releases tab on the right side of this repository.
* Download the latest `FocusTimer.exe` file.
* Run the application (no installation required).

**2. The Chrome Extension**

* Install the official companion extension directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/study-lamp-focus-companio/ghkfinbajcjlbikedmjgeocbknbnnfao?hl=en-US&utm_source=ext_sidebar).

### 💻 For Developers (Running from Source)

If you prefer to run the raw Python script or want to contribute to the project:

* Clone this repository.
* Install the required dependencies: `pip install pyinstaller psutil customtkinter`.
* Run the application: `python FocusTimer.py`.
