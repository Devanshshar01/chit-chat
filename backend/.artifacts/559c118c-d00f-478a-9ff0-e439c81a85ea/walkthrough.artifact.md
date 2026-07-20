# Walkthrough - Automatic Seeding for Render

I have updated the backend to automatically seed both the `devansh` and `swarnima` accounts every time the server starts. This solves the 401 Unauthorized issue caused by the lack of shell access on the Render Free Tier.

## Changes

### [Backend]

#### [main.py](file:///C:/Users/User/StudioProjects/chit-chat/backend/app/main.py)
Updated the `on_startup` hook to call the `seed()` function immediately after the database models are initialized.

```python
@app.on_event("startup")
async def on_startup():
    await init_models()
    # Ensure both "devansh" and "swarnima" accounts exist on every start.
    await seed()
```

### [Verification Results]

- **Idempotency:** The `seed()` function in `app/seed.py` checks if a user already exists before creating them, so this change will not create duplicate accounts or overwrite existing ones.
- **Render Compatibility:** Since your SQLite database is non-persistent on the Free Tier, this ensures the accounts are re-created automatically after every deployment or restart.

## Final Steps for You

To ensure the passwords match exactly what you want, verify your **Environment Variables** in the Render Dashboard:

1.  **SEED_DEVANSH_PASSCODE**: Set this to `DEVANSH`
2.  **SEED_SWARNIMA_PASSCODE**: Set this to `SWARNIMA`

Once these are set and you push the updated `main.py` to GitHub, Render will redeploy, and you will be able to log in with:

- **User 1:** `devansh` / `DEVANSH`
- **User 2:** `swarnima` / `SWARNIMA`

> [!TIP]
> Use exactly the casing shown above (lowercase for usernames, uppercase for passcodes as per your request).
