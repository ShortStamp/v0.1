# ShortStamp v0.1

This project is a web application that allows users to discover makeup trends, build their own looks, and compare prices across different retailers.

## Frontend

The frontend is a Next.js application. To run it, you need to have Node.js and npm installed.

To install the dependencies, run:

```
cd frontend
npm install
```

To run the development server, run:

```
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Backend

The backend is a FastAPI application. To run it, you need to have Python 3.12 and pip installed.

To install the dependencies, run:

```
cd backend
pip install -e .
```

To run the development server, run:

```
uvicorn app.main:app --reload
```

The backend will be available at `http://localhost:8000`.

## Connecting the frontend to the backend

The frontend is connected to the backend using a proxy. The Next.js development server proxies all requests to `/api` to the backend server running on `http://localhost:8000`.

## Populating the Database

To populate the database with sample products, run the following command from the `backend` directory:

```
python -m app.seed
```