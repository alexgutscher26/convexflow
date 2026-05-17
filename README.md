# ConvexFlow

ConvexFlow (also known as CortexFlow MVP) is a full-stack application for managing projects, nodes, and edges, with GitHub repository synchronization and AI-powered helpers. It allows you to visualize and manage software architectures, PRDs, and implementation plans using an interactive node-based graph.

## Features

- **Interactive Node Graph**: Build and visualize relationships between components, user stories, and architecture nodes using React Flow.
- **GitHub Repository Sync**: Connect your projects to GitHub repositories, scan file trees, and detect frameworks automatically.
- **AI-Powered Helpers**: Integrated with Claude Sonnet 4.5 (or local LLMs via Ollama) to expand nodes, generate prompts, and export PRDs.
- **Project Workspaces**: Create greenfield projects or import existing ones, use templates, and organize work effortlessly.
- **Robust Authentication**: Secure JWT-based authentication with bcrypt password hashing.
- **Project Wizard**: Bootstraps greenfield projects based on a short questionnaire.

## Tech Stack

### Frontend

- **Framework**: React (bootstrapped with Create React App / craco)
- **Styling**: Tailwind CSS, Radix UI components
- **State Management**: Zustand
- **Diagramming**: React Flow
- **Forms & Validation**: React Hook Form, Zod
- **API Client**: Axios

### Backend

- **Framework**: FastAPI (Python)
- **Database**: MongoDB (Motor for async operations)
- **Authentication**: PyJWT, Bcrypt
- **AI Integrations**: Custom LLM integration (supports cloud LLMs & local LLMs)

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python (3.10+)
- MongoDB instance running locally or via Atlas

### Backend Setup

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment and install dependencies:

   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. Configure environment variables:
   Ensure you have a `.env` file in the `backend` directory. Here is an example of what it should contain:

   ```env
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=convexflow
   JWT_SECRET=your_super_secret_key
   JWT_ALGORITHM=HS256
   JWT_EXPIRY_DAYS=30
   EMERGENT_LLM_KEY=your_api_key  # Optional, if using cloud LLM
   USE_LOCAL_LLM=true             # Set to true to use local LLM
   LOCAL_LLM_URL=http://localhost:11434/v1
   LOCAL_LLM_MODEL=llama3
   ```

4. Start the backend server:
   If you are in the project root directory:
   ```bash
   python -m uvicorn server:app --reload --app-dir backend
   ```
   Or if you are already inside the `backend` directory:
   ```bash
   python -m uvicorn server:app --reload
   ```
   The API will be available at `http://localhost:8000`.

### Frontend Setup

1. Navigate to the frontend directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the frontend development server:
   ```bash
   npm start
   # or
   yarn start
   ```
   The application will be available at `http://localhost:3000`.

## Key Concepts

- **Nodes**: Represent individual components, features, UI requirements, or architectural elements in your workspace.
- **Edges**: Define relationships between nodes (e.g., `depends_on`, `implements`, `references`).
- **Snapshots**: Capture the state of the entire project graph at a given point in time for history and PRD generation.
- **Repository Sync**: ConvexFlow scans your GitHub repo to highlight stale file references inside your nodes, ensuring documentation stays up-to-date.
