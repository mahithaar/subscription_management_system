import uvicorn
from app.seed import seed_database

if __name__ == "__main__":
    print("Pre-seeding database with demo users, catalog, and subscriptions...")
    try:
        seed_database()
    except Exception as e:
        print(f"Seed info: {e}")

    print("\nStarting RecurOS API on http://127.0.0.1:8000")
    print("Interactive Swagger Documentation: http://127.0.0.1:8000/docs\n")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

