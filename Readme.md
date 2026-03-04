# CodeCollab

CodeCollab is a full-stack collaborative coding platform. It lets multiple users to join a shared room, code together in real time, communicate via chat and video calls, share screens — all in the browser.

## Features
- No Login room creation & sharing via secure URL link or custom Join Code.
- Dynamic Public & Private Rooms (optional password-protection for workspaces).
- Active Public Rooms live directory on the Homepage grid.
- Room capacity limits (1 to 10 participants per room).
- Automatic self-destructing Room Timers (2 minutes to 1 hour durations).
- Custom user naming for private rooms (or auto-generated anonymous names).
- Real-time collaborative code editor (powered by Yjs + Monaco).
- Language selection (JavaScript, Python etc) for syntax highlighting.
- Download your code buffer as a file.
- Integrated Chat with sliding sidebar interface & image upload support.
- Video calling with intuitive Mute/Unmute Mic and Video toggles.
- Advanced Screen Sharing UI with expandable Picture-In-Picture & Grid layouts.
- Universal Light/Dark mode switch across the entire app.

## Future Enhancements
- User authentication & persistent profiles.
- File sharing
- Scheduled rooms
- 


### Demo

![](Screenshots/1.png)
![](Screenshots/2.png)


![](Screenshots/3.png)




<img src="Screenshots/4.png" width="600"/>

<img src="Screenshots/5.png" width="600"/>


<img src="Screenshots/7.png" width="600"/>


### How to start Locally
You will explicitly need Docker Engine API to run the backend locally.

Make sure you install the dependencies first and start the frontend:

```bash
cd client && npm install
npm run dev
```

Run in root Code-collab project to start the backend services:
```bash
docker compose up -d --build
```


