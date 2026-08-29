# Moderator Users Function

This Appwrite Function powers the moderator user picker.

## Appwrite Function settings

- **Function ID:** `moderator-users`
- **Runtime:** Node.js 22
- **Root directory:** `functions/moderator-users`
- **Entrypoint:** `src/main.js`
- **Build command:** `npm install`
- **Production branch:** `main`
- **Execute access:** authenticated users (the function performs the moderator-role check itself)
- **Dynamic API key scope:** `users.read`

Connect the function to this GitHub repository so pushes to `main` deploy automatically.

The browser never receives the Users API key. The function authenticates the caller with the Appwrite user JWT, verifies the `moderator` role in the `Attendance-MOD` team, and only then uses the function's dynamic API key to list project users.
