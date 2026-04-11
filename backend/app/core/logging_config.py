import logging
import sys
from app.core.config import settings

def setup_logging():
    log_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    # Create handlers
    console_handler = logging.StreamHandler(sys.stdout)
    file_handler = logging.FileHandler(settings.LOG_FILE, encoding="utf-8")
    
    # Configure format
    log_format = "%(asctime)s - %(levelname)s - %(name)s - %(message)s"
    formatter = logging.Formatter(log_format)
    console_handler.setFormatter(formatter)
    file_handler.setFormatter(formatter)
    
    # Configure root logger
    logging.basicConfig(
        level=log_level,
        handlers=[console_handler, file_handler],
        force=True,
    )
    
    # Set specific levels for common libraries to reduce noise
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    sqlalchemy_engine_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_engine_logger.setLevel(logging.CRITICAL)
    sqlalchemy_engine_logger.propagate = False

    sqlalchemy_pool_logger = logging.getLogger("sqlalchemy.pool")
    sqlalchemy_pool_logger.setLevel(logging.CRITICAL)
    sqlalchemy_pool_logger.propagate = False

    sqlalchemy_dialects_logger = logging.getLogger("sqlalchemy.dialects")
    sqlalchemy_dialects_logger.setLevel(logging.CRITICAL)
    sqlalchemy_dialects_logger.propagate = False

    logging.getLogger("asyncpg").setLevel(logging.CRITICAL)
    
    logger = logging.getLogger(__name__)
    logger.info(f"Logging initialized in {settings.ENVIRONMENT} mode (DEBUG={settings.DEBUG})")
    logger.info(f"Writing logs to: {settings.LOG_FILE}")
