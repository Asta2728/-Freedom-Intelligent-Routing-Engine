"""Debug runner for the FastAPI application.

This script launches uvicorn with:
- Forced debug/development settings.
- Explicit reload exclusions to prevent infinite loops.
- Verbose logging for troubleshooting.
"""
import os
import uvicorn

def main():
    # Force development environment if not set
    os.environ["ENVIRONMENT"] = "development"
    os.environ["DEBUG"] = "True"
    
    print("🚀 Starting FIRE Backend in DEBUG mode...")
    print("🔧 Reload exclude: .venv, .git, __pycache__")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_excludes=[".venv", ".git", "__pycache__", "tests"],
        log_level="debug",
        access_log=True,
    )

if __name__ == "__main__":
    main()
