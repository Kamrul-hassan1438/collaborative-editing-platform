🧠 Collaborative Document Editor with Version Control

A full-stack collaborative document editing platform built with Django (backend) and React (frontend).
The system allows users to manage workspaces, collaborate on documents, and maintain version history efficiently — with controlled saves only on manual save (Ctrl+S) or Save button.

🚀 Features
🔐 Authentication & Profile

User registration and login with JWT authentication.

Profile management for each user.

Authorization and workspace-based permission checks.

🧩 Workspaces

Users can create and join workspaces.

Admins can manage workspace members.

Workspace-based access control for documents.

📝 Document Editor

Real-time editing (local only, not saved until user action).

Manual save via Save button or Ctrl+S.

Auto warning for unsaved changes when exiting.

Draft auto-saved locally in localStorage until saved.

Retrieve only the latest 5 document versions for performance.

🧾 Version Control

Every save action creates a new version.

Efficient pagination for document versions.

Secure access control — only workspace members can view versions.

🏗️ Project Structure
project-root/
│
├── backend/
│   ├── manage.py
│   ├── core/
│   ├── documents/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   ├── workspaces/
│   └── users/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── WorkspaceList.jsx
│   │   │   ├── WorkspaceDetail.jsx
│   │   │   ├── JoinWorkspace.jsx
│   │   │   └── DocumentEditor.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   └── vite.config.js
│
└── README.md

⚙️ Tech Stack
Backend

Python 3.10+

Django 5+

Django REST Framework (DRF)

SimpleJWT for token-based authentication

Frontend

React 18+

Vite for fast builds

Axios for API requests

Tailwind CSS for modern UI

React Router v6 for routing

🧩 Installation & Setup
1️⃣ Backend Setup
Create Virtual Environment
cd backend
python -m venv venv
source venv/bin/activate     # for Linux/macOS
venv\Scripts\activate        # for Windows

Install Dependencies
pip install -r requirements.txt

Run Migrations
python manage.py makemigrations
python manage.py migrate

Create Superuser
python manage.py createsuperuser

Run Server
python manage.py runserver


Backend runs by default at:
➡️ http://localhost:8000

2️⃣ Frontend Setup
Install Dependencies
cd frontend
npm install

Run Development Server
npm run dev


Frontend runs by default at:
➡️ http://localhost:5173

🔄 API Endpoints
Method	Endpoint	Description
POST	/api/auth/register/	Register new user
POST	/api/auth/login/	User login (JWT tokens)
GET	/api/workspaces/	List all user workspaces
POST	/api/workspaces/:id/join/	Join a workspace
GET	/api/documents/:id/versions/	Get last 5 versions
POST	/api/documents/:id/save/	Save new document version
💾 Document Saving Logic

A version is only created when the user clicks Save or presses Ctrl+S.

The editor detects unsaved changes and shows a warning before exiting.

Local drafts are temporarily stored in localStorage.

The backend limits to last 5 versions when fetching to improve performance.

🔐 JWT Authentication Flow

On login, access and refresh tokens are stored in localStorage.

Axios interceptors automatically attach the Authorization header.

When access_token expires, a refresh call is made to renew it.

If refresh fails, user is redirected to login.

🧠 Key Frontend Components
Component	Description
Login.jsx	Handles user authentication
Register.jsx	New user registration
Profile.jsx	Shows user info and workspace details
WorkspaceList.jsx	Displays available workspaces
WorkspaceDetail.jsx	Shows members and documents of a workspace
JoinWorkspace.jsx	Allows users to join workspaces via invite
DocumentEditor.jsx	Rich text editor with manual version control