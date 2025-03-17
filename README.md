# HyperSpace

HyperSpace is a WebRTC infused file sharing platform that allows users to share files with each other in real-time.
The traffic and all exchange is secure via E2EE (End-to-End Encryption) using ECDH (Elliptic Curve Diffie-Hellman)
key exchange.

The project is built to be a simple, secure and efficient way to share files with others without the need to upload
them to a server. It features no overhead and bloating libraries in JavaScript, and its built using mainly TypeScript
HTMX, and Golang for server.

## Requirements

- Node.js
- Go
- Docker (optional)
- Yarn (optional but preffered)

## Installation

Install the dependencies for the frontend and backend by running the following commands:

```bash
yarn install
```

## Running the project

Running the project requires running a redis instance and the backend server. That's it!

```bash
make start
```

### Additional styles watcher

If you are actively developing the frontend, you can run the following command to watch for changes in the styles:

```bash
yarn build:styles
```
