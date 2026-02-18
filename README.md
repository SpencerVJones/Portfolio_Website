<div align="center">
  <h2 align="center">Portfolio Website</h2>
  <div align="left">
	

![Repo Views](https://visitor-badge.laobi.icu/badge?page_id=SpencerVJones/Portfolio_Website)

</div>

  
<p align="center">
  A personal portfolio web app showcasing projects, experience, and contact details in a polished, interactive interface.  
  Built with <strong>vanilla HTML, CSS, and JavaScript</strong>, backed by a lightweight <strong>Node.js + Express</strong> server for dynamic integrations.
  <br /><br />
  This project highlights my software engineering work and continuous learning journey, with live integrations for  
  <strong>GitHub project data</strong> and <strong>Spotify recently played activity</strong>.
  <br />
  <br />
  <a href="https://github.com/SpencerVJones/Portfolio_Website/issues">Report Bug</a>
    ·
    <a href="https://github.com/SpencerVJones/Portfolio_Website/issues">Request Feature</a>
  </p>
</div>


<!-- PROJECT SHIELDS -->
<div align="center">


![License](https://img.shields.io/badge/License-Proprietary-black?style=for-the-badge)
![Contributors](https://img.shields.io/github/contributors/SpencerVJones/Portfolio_Website?style=for-the-badge)
![Forks](https://img.shields.io/github/forks/SpencerVJones/Portfolio_Website?style=for-the-badge)
![Stargazers](https://img.shields.io/github/stars/SpencerVJones/Portfolio_Website?style=for-the-badge)
![Issues](https://img.shields.io/github/issues/SpencerVJones/Portfolio_Website?style=for-the-badge)
![Last Commit](https://img.shields.io/github/last-commit/SpencerVJones/Portfolio_Website?style=for-the-badge)
![Repo Size](https://img.shields.io/github/repo-size/SpencerVJones/Portfolio_Website?style=for-the-badge)

![Platform](https://img.shields.io/badge/Platform-Web-lightgrey.svg?style=for-the-badge&logo=google-chrome&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-111111?style=for-the-badge&logo=express&logoColor=white)
![GitHub API](https://img.shields.io/badge/GitHub%20API-181717?style=for-the-badge&logo=github&logoColor=white)
![Spotify API](https://img.shields.io/badge/Spotify%20API-1DB954?style=for-the-badge&logo=spotify&logoColor=white)


</div>



## 📑 Table of Contents
- [Overview](#overview)
- [Technologies Used](#technologies-used)
- [Architecture](#architecture)
- [Features](#features)
- [Demo](#demo)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [How to Run](#how-to-run)
- [Usage](#usage)
- [Roadmap](#roadmap)
- [Contributors](#contributors)
- [License](#license)
- [Contact](#contact)

## Overview
**Portfolio Website** is an interactive personal portfolio focused on clear storytelling, polished visuals, and practical project presentation.  
It combines a modern frontend experience with lightweight backend endpoints for dynamic content.

This repository is structured as a **frontend (`src/`) + Express server (`server/`)** project that can be run locally or deployed to a Node-compatible host.


## Technologies Used
- **JavaScript (ES6+)**
- **HTML5 / CSS3**
- **Node.js + Express**
- **dotenv** (environment configuration)
- **GitHub + Spotify APIs**

## Architecture
- **Static frontend** rendered from `src/home.html`, `src/homeStyle.css`, and `src/homeScript.js`  
- **Express backend** in `server/index.mjs` serving static assets and API routes  
- API endpoints for **GitHub pinned repositories** and **Spotify recently played track**  
- Backend API is deployed on **Render** at `https://portfolio-website-11uq.onrender.com`  
- Environment-driven config via `.env` for API credentials and CORS

## Features
- ✨ Animated, responsive portfolio UI with dark/light theme support
- 🧠 Dynamic project section powered by GitHub repository data
- 📌 Pinned project prioritization via GitHub profile scraping endpoint
- 🎵 Spotify “recently played” integration with token refresh flow
- 📬 Contact form integration for quick outreach

## Demo
🔗 **Live:** [https://spencervjones.dev](https://spencervjones.dev)



https://github.com/user-attachments/assets/cf91797f-b8b1-4999-9589-e5c14e2e7067



## Project Structure
```bash
Portfolio_Website/
├── Demo/                        # Demo assets (gif, mp4, etc.)
├── images/                      # Portfolio and profile image assets
├── server/                      # Node/Express backend
│   └── index.mjs                # API routes + static hosting
├── src/                         # Frontend source files
│   ├── home.html                # Main portfolio page
│   ├── homeStyle.css            # Styling
│   └── homeScript.js            # Client-side interactions/data
├── index.html                   # Entry page
├── package.json                 # Scripts + dependencies
├── package-lock.json            # Locked dependency tree
└── README.md
```
## Testing
Coming Soon!


## Getting Started
### Prerequisites
-  **Node.js** (LTS recommended)
-   npm
-   (Optional) `.env` file for Spotify/CORS configuration

### Installation
```bash
git clone https://github.com/SpencerVJones/Portfolio_Website.git
cd Portfolio_Website
npm install
```
 
### How to Run
```bash
npm run dev     # start local server (same as npm start)
npm start       # start server/index.mjs
```

## Usage
-   Start the app locally and open the printed localhost URL.
-   Browse portfolio sections: About, Projects, Experience, Contact.
-   Optionally configure API env vars to enable Spotify and stricter CORS behavior.
 
## Roadmap
 - [ ] Add automated tests for backend routes and frontend behavior
 - [ ] Add CI checks for linting and deployment validation
 - [ ] Expand project filtering and search controls

See open issues for a full list of proposed features (and known issues).
 

## Contributors
<a href="https://github.com/SpencerVJones/Portfolio_Website/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SpencerVJones/Portfolio_Website"/>
</a>


## License
Copyright (c) 2026 Spencer Jones
<br>
All rights reserved.
<br>
Permission is granted to view this code for personal and educational purposes only.
<br>
No permission is granted to copy, modify, distribute, sublicense, or sell any portion of this code without explicit written consent from the author.


## Contact
Spencer Jones
📧 [SpencerVJones@outlook.com](mailto:SpencerVJones@outlook.com)  
🔗 [GitHub Profile](https://github.com/SpencerVJones)  
🔗 [Project Repository](https://github.com/SpencerVJones/Portfolio_Website)
